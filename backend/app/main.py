from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import load_settings
from app.database import Match, Prediction, User, get_or_create_user, get_or_create_user_google, init_db, session_scope

from sqlalchemy import select
from pydantic import BaseModel
import json
import os
import secrets
from pathlib import Path
from datetime import datetime, timezone
import time
import httpx
from urllib.parse import urlencode

from app.services.ai_service import generate_events, extract_actual_event_from_text
from app.services.oracle_service import process_actual_event
from app.database import ActualEvent
from app.services.live_monitor import start_live_monitor
from app.services.discovery_liquipedia import register_liquipedia_discovery
from app.services.discovery_mls_youtube import register_mls_youtube_discovery
from app.services.twitch_scraper import register_twitch_scraper
from app.services.stream_resolver import resolve_stream_for_match_id
from app.services.simulator import load_demo_matches, start_demo_simulator


class GenerateEventsRequest(BaseModel):
    matchId: str
    description: str


class PredictRequest(BaseModel):
    matchId: str
    eventType: str
    predictedTimeSeconds: int
    username: str | None = None


class ValidateLiveFeedRequest(BaseModel):
    matchId: str
    textFeed: str


class GoogleAuthRequest(BaseModel):
    token: str


class AddScoreRequest(BaseModel):
    username: str


def _google_client_id() -> str:
    return (os.getenv("Google_Client_ID") or os.getenv("GOOGLE_CLIENT_ID") or "").strip()


def _google_client_secret() -> str:
    return (os.getenv("Google_Client_secret") or os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()


def _frontend_url() -> str:
    return (os.getenv("FRONTEND_URL") or "https://top-prophets-panel.onrender.com").rstrip("/")


def _backend_url() -> str:
    return (os.getenv("BACKEND_URL") or os.getenv("RENDER_EXTERNAL_URL") or "").rstrip("/")


def create_app() -> FastAPI:
    settings = load_settings()

    app = FastAPI(title="TOP-PROPHETS API", version="0.1.0")

    if settings.cors_origins:
        cors_origins = settings.cors_origins
    else:
        cors_origins = ['*']

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    prefix = settings.api_prefix.rstrip('/')

    # В demo-режиме используем только локальные demo_matches.json, без LiveEngine.
    if settings.demo_mode:
        demo_matches = load_demo_matches()
        engine = None
    else:
        from app.services.live_engine import LiveEngine
        engine = LiveEngine(settings)

    # Background watcher / discovery only в проде.
    if not settings.demo_mode:
        start_live_monitor(app, settings)
        register_liquipedia_discovery(app)
        register_mls_youtube_discovery(app)
        register_twitch_scraper(app)

    @app.get(f"{prefix}/api/matches")
    async def get_matches(category: str | None = None):
        if settings.demo_mode:
            items = list(demo_matches.values())
            
            formatted_matches = []
            for m in items:
                # Маппинг категорий для demo
                raw_sport = (getattr(m, 'sport', '') or "").lower()
                m_category = "dota2" if raw_sport in {"esports", "dota2"} else "football"
                
                # Фильтрация
                if category and m_category != category:
                    continue
                
                teams = m.title.split(" vs ")
                t1 = teams[0] if len(teams) > 0 else "Team 1"
                t2 = teams[1].split("|")[0].strip() if len(teams) > 1 else "Team 2"

                formatted_matches.append({
                    "id": m.id,
                    "title": m.title,
                    "type": "resolved",
                    "category": m_category,
                    "team1": t1,
                    "team2": t2,
                    "tournament": getattr(m, 'tournament', None),
                    "startTimeUnix": getattr(m, 'start_time_unix', int(time.time())),
                    "status": "live",
                    "streamUrl": m.stream_url,
                    "apiFixtureId": None,
                })

            return {"matches": formatted_matches}
        else:
            async with session_scope() as session:
                q = select(Match).order_by(Match.start_time_unix.asc()).limit(100)
                if category:
                    q = q.where(Match.category == category)
                rows = list((await session.execute(q)).scalars().all())
                return {
                    "matches": [
                        {
                            "id": m.id,
                            "title": f"{m.team1} vs {m.team2}",
                            "type": "resolved",
                            "category": m.category,
                            "team1": m.team1,
                            "team2": m.team2,
                            "tournament": m.tournament,
                            "startTimeUnix": m.start_time_unix,
                            "status": m.status,
                            "streamUrl": m.stream_url,
                            "apiFixtureId": m.api_fixture_id,
                        }
                        for m in rows
                    ]
                }

    @app.post(f"{prefix}/api/admin/generate-events")
    async def admin_generate_events(req: GenerateEventsRequest):
        gen = await generate_events(req.description)

        events_path = Path(settings.events_path)
        raw = {}
        if events_path.exists():
            raw = json.loads(events_path.read_text(encoding='utf-8') or '{}')
        raw[req.matchId] = [e.model_dump() for e in gen.events]
        events_path.parent.mkdir(parents=True, exist_ok=True)
        events_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding='utf-8')

        matches_path = Path(settings.matches_path)
        try:
            if matches_path.exists():
                matches_raw = json.loads(matches_path.read_text(encoding='utf-8') or '[]')
                if isinstance(matches_raw, list):
                    for m in matches_raw:
                        if m.get('id') == req.matchId:
                            m['events'] = [e.model_dump() for e in gen.events]
                elif isinstance(matches_raw, dict):
                    if req.matchId in matches_raw:
                        matches_raw[req.matchId]['events'] = [e.model_dump() for e in gen.events]
                matches_path.write_text(json.dumps(matches_raw, ensure_ascii=False, indent=2), encoding='utf-8')
        except Exception:
            pass

        if not settings.demo_mode:
            engine.reload_configs()
        return {
            "matchId": req.matchId,
            "events": [e.model_dump() for e in gen.events],
        }

    @app.post(f"{prefix}/api/admin/validate-live-feed")
    async def admin_validate_live_feed(req: ValidateLiveFeedRequest):
        extracted = await extract_actual_event_from_text(req.textFeed)

        async with session_scope() as session:
            result = await process_actual_event(
                session=session,
                match_id=req.matchId,
                event_type=extracted.event_type,
                actual_time_seconds=extracted.actual_time_seconds,
            )

        return {
            "matchId": req.matchId,
            "eventType": extracted.event_type,
            "actualTimeSeconds": extracted.actual_time_seconds,
            "winners": result.get("winners", []),
            "new": result.get("new", True),
        }

    @app.post(f"{prefix}/api/predict")
    async def post_predict(req: PredictRequest):
        username = req.username or 'guest'
        async with session_scope() as session:
            user = await get_or_create_user(session, username=username)
            pred = Prediction(
                user_id=user.id,
                match_id=req.matchId,
                predicted_time_seconds=int(req.predictedTimeSeconds),
                event_type=req.eventType,
            )
            session.add(pred)
            await session.commit()
            return {"ok": True, "predictionId": pred.id}

    @app.post(f"{prefix}/api/auth/google")
    async def auth_google(req: GoogleAuthRequest):
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": req.token})
            r.raise_for_status()
            payload = r.json()
        email = str(payload.get("email") or "")
        name = str(payload.get("name") or payload.get("given_name") or "Google User")
        if not email:
            return {"ok": False, "error": "email_not_found"}

        async with session_scope() as session:
            user = await get_or_create_user_google(session, email=email, name=name)
            await session.commit()
            return {
                "ok": True,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "name": user.name,
                },
            }

    @app.get(f"{prefix}/api/auth/google/login")
    async def auth_google_login(request: Request):
        client_id = _google_client_id()
        backend_url = _backend_url() or str(request.base_url).rstrip("/")
        if not client_id or not backend_url:
            return {"ok": False, "error": "google_oauth_not_configured"}

        state = secrets.token_urlsafe(24)
        redirect_uri = f"{backend_url}{prefix}/api/auth/google/callback"
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
            "state": state,
        }
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return RedirectResponse(url=url, status_code=307)

    @app.get(f"{prefix}/api/auth/google/callback")
    async def auth_google_callback(
        request: Request,
        code: str | None = None,
        state: str | None = None,
    ):
        client_id = _google_client_id()
        client_secret = _google_client_secret()
        backend_url = _backend_url() or str(request.base_url).rstrip("/")
        frontend_url = _frontend_url()
        if not client_id or not client_secret or not backend_url:
            return RedirectResponse(url=f"{frontend_url}/?auth_error=oauth_not_configured", status_code=307)
        if not code:
            return RedirectResponse(url=f"{frontend_url}/?auth_error=missing_code", status_code=307)

        redirect_uri = f"{backend_url}{prefix}/api/auth/google/callback"
        token_form = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                token_resp = await client.post("https://oauth2.googleapis.com/token", data=token_form)
                token_resp.raise_for_status()
                token_payload = token_resp.json()
                id_token = str(token_payload.get("id_token") or "")
                if not id_token:
                    return RedirectResponse(url=f"{frontend_url}/?auth_error=missing_id_token", status_code=307)

                info_resp = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": id_token})
                info_resp.raise_for_status()
                payload = info_resp.json()
        except Exception:
            return RedirectResponse(url=f"{frontend_url}/?auth_error=oauth_exchange_failed", status_code=307)

        email = str(payload.get("email") or "")
        name = str(payload.get("name") or payload.get("given_name") or "Google User")
        if not email:
            return RedirectResponse(url=f"{frontend_url}/?auth_error=email_not_found", status_code=307)

        async with session_scope() as session:
            user = await get_or_create_user_google(session, email=email, name=name)
            await session.commit()

        qs = urlencode({
            "auth_ok": "1",
            "username": user.username,
            "email": user.email or "",
            "name": user.name or "",
            "state": state or "",
        })
        return RedirectResponse(url=f"{frontend_url}/?{qs}", status_code=307)

    # Исправлено: регистрируем эндпоинт стрима ВСЕГДА, но с разной логикой
    @app.post(f"{prefix}/api/stream/resolve")
    async def resolve_stream(matchId: str):
        if settings.demo_mode:
            # В демо просто берем URL из загруженных демо-матчей
            match_obj = demo_matches.get(matchId)
            stream_url = match_obj.stream_url if match_obj else ""
            return {"ok": True, "matchId": matchId, "streamUrl": stream_url}
        else:
            stream = await resolve_stream_for_match_id(matchId)
            return {"ok": True, "matchId": matchId, "streamUrl": stream}

    @app.post(f"{prefix}/api/score/add")
    async def add_score(req: AddScoreRequest):
        """
        Increment the user's score (total_xp) by 1.
        Creates a new user with the given username if it doesn't exist.
        """
        username = req.username.strip()
        if not username:
            return {"ok": False, "error": "username required"}

        async with session_scope() as session:
            user = await get_or_create_user(session, username=username)
            user.total_xp = (user.total_xp or 0) + 1
            await session.commit()
            return {"ok": True, "username": username, "newScore": user.total_xp}

    @app.get(f"{prefix}/api/leaderboard")
    async def get_leaderboard():
        async with session_scope() as session:
            q = select(User).order_by(User.total_xp.desc()).limit(10)
            res = await session.execute(q)
            users = list(res.scalars().all())
            return {
                "entries": [
                    {"id": f"u_{u.username}", "username": u.username, "score": int(u.total_xp or 0)}
                    for u in users
                ]
            }

    @app.get(f"{prefix}/api/events/latest")
    async def get_latest_events(matchId: str, limit: int = 10):
        limit = max(1, min(int(limit), 50))
        async with session_scope() as session:
            q = (
                select(ActualEvent)
                .where(ActualEvent.match_id == matchId)
                .order_by(ActualEvent.created_at.desc())
                .limit(limit)
            )
            res = await session.execute(q)
            items = list(res.scalars().all())

        return {
            "events": [
                {
                    "id": e.id,
                    "eventType": e.event_type,
                    "actualTimeSeconds": e.actual_time_seconds,
                    "createdAt": e.created_at.isoformat(),
                }
                for e in items
            ]
        }

    @app.on_event("startup")
    async def _startup() -> None:
        await init_db()
        if settings.demo_mode:
            await start_demo_simulator(app, settings)

    return app


app = create_app()
