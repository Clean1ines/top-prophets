from __future__ import annotations

import asyncio
import logging
import re
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from app.database import session_scope, upsert_match

logger = logging.getLogger(__name__)

LIQUIPEDIA_URL = "https://liquipedia.net/dota2/Main_Page"
_CACHE_TTL_SECONDS = 300
_cache_html: str | None = None
_cache_ts: float = 0.0


def _normalize_team(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


async def _fetch_html() -> str:
    global _cache_html, _cache_ts
    now = time.time()
    if _cache_html and now - _cache_ts <= _CACHE_TTL_SECONDS:
        return _cache_html

    headers = {
        "User-Agent": "Mozilla/5.0 (TOP-PROPHETS bot)",
        "Accept-Language": "en-US,en;q=0.9",
    }
    def _do_request() -> str:
        resp = requests.get(LIQUIPEDIA_URL, headers=headers, timeout=25)
        resp.raise_for_status()
        return resp.text

    html = await asyncio.to_thread(_do_request)
    _cache_html = html
    _cache_ts = now
    return _cache_html


def _parse_timestamp(raw: str) -> int | None:
    try:
        ts = int(float(raw))
    except Exception:
        return None
    # Liquipedia can expose timestamps in ms.
    if ts > 10_000_000_000:
        ts = ts // 1000
    if ts <= 0:
        return None
    return ts


def _extract_matches(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("div.match-info")
    out: list[dict] = []
    seen_keys: set[str] = set()
    now_unix = int(datetime.now(tz=timezone.utc).timestamp())

    for row in rows:
        timer = row.select_one("span.timer-object[data-timestamp]")
        ts = _parse_timestamp(timer.get("data-timestamp") if timer else "")
        if ts is None:
            continue
        # Keep reasonable horizon: recent live and upcoming.
        if ts < now_unix - 4 * 3600:
            continue
        if ts > now_unix + 7 * 24 * 3600:
            continue

        left_name = row.select_one(".match-info-header-opponent-left .block-team .name")
        right_name = row.select_one(
            ".match-info-header-opponent:not(.match-info-header-opponent-left) .block-team .name"
        )
        team1 = _normalize_team(left_name.get_text(" ", strip=True).replace("\xa0", " ")) if left_name else ""
        team2 = _normalize_team(right_name.get_text(" ", strip=True).replace("\xa0", " ")) if right_name else ""
        if not team1 or not team2:
            continue

        tournament_node = row.select_one(".match-info-tournament-name a, .match-info-tournament-name span")
        tournament = (
            _normalize_team(tournament_node.get_text(" ", strip=True).replace("\xa0", " "))
            if tournament_node
            else "Liquipedia Dota2"
        )
        start_time_unix = int(ts)
        status = "live" if (start_time_unix - 15 * 60) <= now_unix <= (start_time_unix + 4 * 3600) else "upcoming"
        ext_key = f"dota2:{team1.lower()}:{team2.lower()}:{start_time_unix}"
        if ext_key in seen_keys:
            continue
        seen_keys.add(ext_key)
        out.append(
            {
                "external_key": ext_key,
                "team1": team1,
                "team2": team2,
                "tournament": tournament,
                "category": "dota2",
                "start_time_unix": start_time_unix,
                "status": status,
            }
        )
    return out


async def run_liquipedia_discovery_once() -> int:
    try:
        html = await _fetch_html()
    except Exception:
        logger.exception("Liquipedia fetch failed")
        return 0

    items = _extract_matches(html)
    if not items:
        logger.info("Liquipedia discovery: no matches parsed")
        return 0

    count = 0
    async with session_scope() as session:
        for m in items:
            await upsert_match(session, **m)
            count += 1
        await session.commit()

    logger.info("Liquipedia discovery upserted %s matches", count)
    return count


def register_liquipedia_discovery(app) -> None:
    @app.on_event("startup")
    async def _liquipedia_on_start() -> None:
        await run_liquipedia_discovery_once()

        async def _loop():
            while True:
                try:
                    await run_liquipedia_discovery_once()
                except Exception:
                    logger.exception("Liquipedia background discovery loop error")
                await asyncio.sleep(600)

        asyncio.create_task(_loop())

