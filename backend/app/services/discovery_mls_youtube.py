from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from datetime import datetime
from typing import Optional

import httpx

from app.database import session_scope, upsert_match

logger = logging.getLogger(__name__)

YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
MLS_CHANNEL_ID = "UC3IuGFqMqhKqG_pV-O9cN5Q"

_CACHE_TTL_SECONDS = 600
_last_seen_video_ids: set[str] = set()
_last_discovery_ts: float = 0.0


def _split_teams_from_title(title: str) -> tuple[Optional[str], Optional[str]]:
    # Expected separators from requirement.
    normalized = re.sub(r"\s+", " ", title.replace("\xa0", " ")).strip()
    separators = [" vs ", " VS ", " Vs ", " – ", " — ", " v "]
    for sep in separators:
        if sep in normalized:
            left, right = normalized.split(sep, 1)
            team1 = left.strip()
            # Right side often contains league/extra text after '|', '-'.
            right = right.strip()
            right = right.split("|", 1)[0].strip()
            right = right.split(" - ", 1)[0].strip()
            right = right.split(" — ", 1)[0].strip()
            team2 = right.strip()
            return (team1 or None, team2 or None)
    return (None, None)


def _parse_unix_from_text(text: str) -> Optional[int]:
    # Best-effort: if description contains a 10-digit unix timestamp in seconds.
    m = re.search(r"\b(1[0-9]{9})\b", text)
    if not m:
        return None
    v = int(m.group(1))
    # Ignore timestamps too far in the past/future.
    now = int(time.time())
    if v < now - 3600 * 24 * 30:
        return None
    if v > now + 3600 * 24 * 30:
        return None
    return v


async def run_mls_discovery_once() -> int:
    api_key = os.getenv("YT_API_KEY", "").strip()
    if not api_key:
        return 0

    global _last_discovery_ts, _last_seen_video_ids
    now_ts = time.time()
    if now_ts - _last_discovery_ts <= _CACHE_TTL_SECONDS:
        # Avoid hammering YouTube every startup restart.
        return 0
    _last_discovery_ts = now_ts

    async def _fetch(event_type: str) -> list[dict]:
        params = {
            "part": "snippet",
            "channelId": MLS_CHANNEL_ID,
            "eventType": event_type,
            "type": "video",
            "maxResults": 10,
            "key": api_key,
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(YT_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        return data.get("items", []) if isinstance(data, dict) else []

    live_items = await _fetch("live")
    upcoming_items = await _fetch("upcoming")
    items = [*live_items, *upcoming_items]
    if not items:
        logger.info("MLS YouTube discovery upserted 0 matches")
        return 0

    discovered = 0
    async with session_scope() as session:
        for item in items:
            try:
                snippet = item.get("snippet") or {}
                title = str(snippet.get("title") or "")
                description = str(snippet.get("description") or "")

                resource = item.get("id") or {}
                video_id = str(resource.get("videoId") or "")
                if not video_id:
                    continue

                if video_id in _last_seen_video_ids:
                    continue
                _last_seen_video_ids.add(video_id)

                team1, team2 = _split_teams_from_title(title)
                if not team1 or not team2:
                    continue

                tournament = "MLS"
                stream_url = f"https://www.youtube.com/watch?v={video_id}"

                start_time_unix = int(datetime.now().timestamp()) + 7200
                parsed_unix = _parse_unix_from_text(description)
                if parsed_unix:
                    start_time_unix = parsed_unix

                external_key = f"mls_youtube:{video_id}"
                await upsert_match(
                    session,
                    external_key=external_key,
                    team1=team1,
                    team2=team2,
                    tournament=tournament,
                    category="football",
                    start_time_unix=start_time_unix,
                    status="upcoming",
                    stream_url=stream_url,
                    api_fixture_id=None,
                )
                discovered += 1
            except Exception:
                logger.exception("MLS YouTube row parse/upsert failed")
                continue

        await session.commit()

    logger.info("MLS YouTube discovery upserted %s matches", discovered)
    return discovered


def register_mls_youtube_discovery(app) -> None:
    @app.on_event("startup")
    async def _mls_on_start() -> None:
        try:
            await run_mls_discovery_once()
        except Exception:
            logger.exception("MLS discovery initial run failed")

        async def _loop() -> None:
            while True:
                try:
                    await run_mls_discovery_once()
                except Exception:
                    logger.exception("MLS discovery loop error")
                await asyncio.sleep(600)

        asyncio.create_task(_loop())

