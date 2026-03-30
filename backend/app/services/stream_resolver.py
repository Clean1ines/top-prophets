from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
import re

import httpx

from app.database import Match, session_scope
from app.services.twitch_scraper import get_twitch_stream_url

logger = logging.getLogger(__name__)

_YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ").strip().lower())


def _is_relevant_title(title: str, team1: str, team2: str, tournament: str) -> bool:
    t = _norm(title)
    a = _norm(team1)
    b = _norm(team2)
    trn = _norm(tournament)
    if not a or not b:
        return False
    if a in t and b in t:
        return True
    # fallback by prefixes for noisy titles
    if len(a) >= 4 and len(b) >= 4 and a[:4] in t and b[:4] in t:
        return True
    # allow tournament+one-team only for football MLS channel noise
    if trn and trn in t and ((a and a in t) or (b and b in t)):
        return True
    return False


async def _search_youtube_live(query: str, *, channel_id: str | None = None, max_results: int = 5) -> str | None:
    api_key = os.getenv("YT_API_KEY")
    if not api_key:
        return None

    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "eventType": "live",
        "maxResults": max_results,
        "key": api_key,
    }
    if channel_id:
        params["channelId"] = channel_id
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(_YT_SEARCH_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    items = data.get("items", []) if isinstance(data, dict) else []
    if not items:
        return None
    # caller validates relevance by title.
    for it in items:
        video_id = (((it or {}).get("id")) or {}).get("videoId")
        if video_id:
            return f"https://www.youtube.com/watch?v={video_id}"
    return None


async def resolve_stream(match: Match) -> str | None:
    now_unix = int(datetime.now(timezone.utc).timestamp())
    if now_unix < (int(match.start_time_unix) - 600):
        return match.stream_url

    team1 = match.team1 or ""
    team2 = match.team2 or ""
    tournament = match.tournament or ""

    # 1) Football: strict MLS channel first.
    if (match.category or "").lower() == "football":
        mls_channel_id = "UC3IuGFqMqhKqG_pV-O9cN5Q"
        query = f"{team1} vs {team2}"
        api_key = os.getenv("YT_API_KEY")
        if api_key:
            params = {
                "part": "snippet",
                "channelId": mls_channel_id,
                "eventType": "live",
                "type": "video",
                "maxResults": 10,
                "key": api_key,
            }
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(_YT_SEARCH_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
            for it in (data.get("items", []) if isinstance(data, dict) else []):
                vid = (((it or {}).get("id")) or {}).get("videoId")
                title = str(((it or {}).get("snippet") or {}).get("title") or "")
                if vid and _is_relevant_title(title, team1, team2, "MLS"):
                    return f"https://www.youtube.com/watch?v={vid}"

        # If no relevant MLS live stream, optionally try twitch strict.
        twitch_url = get_twitch_stream_url(team1, team2, tournament)
        if twitch_url:
            return twitch_url
        return None

    # 2) Dota/esports: Twitch strict by teams/tournament first.
    twitch_url = get_twitch_stream_url(team1, team2, tournament)
    if twitch_url:
        return twitch_url

    # 3) YouTube fallback only if title is relevant.
    api_key = os.getenv("YT_API_KEY")
    if api_key:
        query = f"{team1} vs {team2} {tournament} live"
        params = {
            "part": "snippet",
            "q": query,
            "eventType": "live",
            "type": "video",
            "maxResults": 8,
            "key": api_key,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(_YT_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        for it in (data.get("items", []) if isinstance(data, dict) else []):
            vid = (((it or {}).get("id")) or {}).get("videoId")
            title = str(((it or {}).get("snippet") or {}).get("title") or "")
            if vid and _is_relevant_title(title, team1, team2, tournament):
                return f"https://www.youtube.com/watch?v={vid}"
    return None


async def resolve_stream_for_match_id(match_id: str) -> str | None:
    async with session_scope() as session:
        match = await session.get(Match, match_id)
        if not match:
            return None
        resolved = await resolve_stream(match)
        if resolved and resolved != match.stream_url:
            match.stream_url = resolved
            await session.commit()
            logger.info("Resolved stream for match=%s -> %s", match.id, resolved)
        return match.stream_url

