from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timedelta, timezone

import httpx

from app.database import session_scope, upsert_match

logger = logging.getLogger(__name__)

_API_URL = "https://allsportsapi2.p.rapidapi.com/api/football/"
_CACHE_TTL_SECONDS = 10
_cache: dict[str, tuple[float, list[dict]]] = {}


def _headers() -> dict[str, str]:
    return {
        "X-RapidAPI-Key": os.getenv("RAPID_API_KEY", ""),
        "X-RapidAPI-Host": "allsportsapi2.p.rapidapi.com",
    }


def _date_strings() -> list[str]:
    today = datetime.now(timezone.utc).date()
    tomorrow = today + timedelta(days=1)
    return [today.isoformat(), tomorrow.isoformat()]


async def _fetch_day(date_iso: str) -> list[dict]:
    now = time.time()
    cached = _cache.get(date_iso)
    if cached and (now - cached[0] <= _CACHE_TTL_SECONDS):
        return cached[1]

    if not os.getenv("RAPID_API_KEY"):
        return []

    async with httpx.AsyncClient(timeout=20) as client:
        # allsportsapi2 uses its own APIkey param; RapidAPI key is used for authentication headers.
        resp = await client.get(
            _API_URL,
            params={"met": "Fixtures", "from": date_iso, "to": date_iso, "timezone": "UTC"},
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("result", []) if isinstance(data, dict) else []
        _cache[date_iso] = (now, items)
        return items


async def _fetch_live() -> list[dict]:
    now = time.time()
    cache_key = "live"
    cached = _cache.get(cache_key)
    if cached and (now - cached[0] <= _CACHE_TTL_SECONDS):
        return cached[1]

    if not os.getenv("RAPID_API_KEY"):
        return []

    async with httpx.AsyncClient(timeout=20) as client:
        # allsportsapi2 uses its own APIkey param; RapidAPI key is used for authentication headers.
        resp = await client.get(
            _API_URL,
            params={"met": "Livescore", "timezone": "UTC"},
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("result", []) if isinstance(data, dict) else []
        _cache[cache_key] = (now, items)
        return items


def _is_live_status(status_short: str) -> bool:
    s = status_short.strip().lower()
    return s in {"1h", "2h", "et", "live", "ht", "p", "bt", "inplay", "playing"}


async def run_football_discovery_once() -> int:
    total = 0
    async with session_scope() as session:
        live_ids: set[str] = set()
        try:
            live_rows = await _fetch_live()
            for row in live_rows:
                event_key = row.get("event_key")
                if event_key is not None:
                    live_ids.add(str(event_key))
        except Exception:
            logger.exception("Football live discovery failed")

        for date_iso in _date_strings():
            try:
                items = await _fetch_day(date_iso)
            except Exception:
                logger.exception("Football discovery failed for date=%s", date_iso)
                continue

            for row in items:
                try:
                    fixture_id = row.get("event_key")
                    if not fixture_id:
                        continue
                    home = row.get("event_home_team") or "Unknown Home"
                    away = row.get("event_away_team") or "Unknown Away"
                    tournament = row.get("league_name") or "Football"
                    date_str = row.get("event_date")
                    time_str = row.get("event_time") or "00:00"
                    if not date_str:
                        continue

                    try:
                        dt = datetime.fromisoformat(f"{date_str}T{time_str}:00+00:00")
                    except Exception:
                        # Some feeds return time like "20:30" without seconds; keep fallback.
                        dt = datetime.fromisoformat(f"{date_str}T00:00:00+00:00")
                    start_unix = int(dt.timestamp())

                    event_live = str(row.get("event_live") or "").strip()
                    status_text = str(row.get("event_status") or "")
                    fixture_id_str = str(fixture_id)
                    is_live = fixture_id_str in live_ids or event_live == "1" or _is_live_status(status_text)
                    if not is_live:
                        continue

                    status = "live"
                    external_key = f"football:{fixture_id_str}"
                    await upsert_match(
                        session,
                        external_key=external_key,
                        team1=home,
                        team2=away,
                        tournament=tournament,
                        category="football",
                        start_time_unix=start_unix,
                        status=status,
                        api_fixture_id=fixture_id_str,
                    )
                    total += 1
                except Exception:
                    logger.exception("Football row parse/upsert failed")
        await session.commit()

    logger.info("Football discovery upserted %s matches", total)
    return total


def register_football_discovery(app) -> None:
    @app.on_event("startup")
    async def _football_on_start() -> None:
        await run_football_discovery_once()

        async def _loop():
            while True:
                try:
                    await run_football_discovery_once()
                except Exception:
                    logger.exception("Football background discovery loop error")
                await asyncio.sleep(600)

        asyncio.create_task(_loop())

