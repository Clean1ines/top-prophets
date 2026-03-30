from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from typing import Optional
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from app.database import Match, session_scope

logger = logging.getLogger(__name__)


def _normalize_token(s: str) -> str:
    s = s or ""
    s = s.replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def get_twitch_stream_url(team1: str, team2: str, tournament: str) -> str | None:
    # Scrape Twitch search results (no API).
    term = f"{team1} vs {team2} {tournament}".strip()
    if not term:
        return None

    url = f"https://www.twitch.tv/search?term={quote_plus(term)}&type=channels"
    headers = {
        "User-Agent": "Mozilla/5.0 (TOP-PROPHETS bot)",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
    except Exception:
        logger.exception("Twitch search request failed")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    page_text = soup.get_text(" ", strip=True).lower()

    t1 = _normalize_token(team1)
    t2 = _normalize_token(team2)
    t = _normalize_token(tournament)

    # Collect candidate channel links.
    candidates: list[str] = []
    seen: set[str] = set()
    for a in soup.select('a[href^="/"][href*="twitch.tv"]'):
        # Some pages encode full twitch urls, others only relative links.
        href = a.get("href") or ""
        if not href:
            continue
        if href.startswith("https://www.twitch.tv/"):
            channel_url = href
        else:
            # Convert relative link.
            channel = href.strip("/").split("/")[0]
            channel_url = f"https://www.twitch.tv/{channel}"
        if channel_url not in seen:
            seen.add(channel_url)
            candidates.append(channel_url)

    # Fallback: relative links like href="/channel"
    if not candidates:
        for a in soup.select('a[href^="/"]'):
            href = a.get("href") or ""
            # Ignore non-channel links.
            m = re.match(r"^/([A-Za-z0-9_]{3,25})/?$", href)
            if not m:
                continue
            channel_url = f"https://www.twitch.tv/{m.group(1)}"
            if channel_url in seen:
                continue
            seen.add(channel_url)
            candidates.append(channel_url)

    def looks_like_live_context(ctx: str) -> bool:
        # Best-effort: twitch search usually contains "LIVE" markers somewhere.
        c = ctx.lower()
        return "live" in c or "в эфире" in c

    # Iterate candidates and return the first that matches search context.
    for channel_url in candidates[:8]:
        channel_text = ""
        # Find the surrounding text for this anchor (not perfect).
        anchor = soup.find("a", href=re.compile(re.escape(channel_url.replace("https://www.twitch.tv/", "/"))))
        if anchor:
            channel_text = anchor.parent.get_text(" ", strip=True) if anchor.parent else anchor.get_text(" ", strip=True)
        else:
            channel_text = page_text

        ctx = f"{channel_text} {page_text}".lower()
        if not looks_like_live_context(ctx):
            continue

        # Require at least one team token and optionally tournament.
        ok_team = (t1 and t1[:3] in ctx) or (t2 and t2[:3] in ctx) or (team1.lower() in ctx) or (team2.lower() in ctx)
        if not ok_team:
            continue

        if t and t in ctx:
            return channel_url
        # If tournament not present, still allow if teams are present.
        return channel_url

    return None


def register_twitch_scraper(app) -> None:
    @app.on_event("startup")
    async def _twitch_loop() -> None:
        async def _loop() -> None:
            while True:
                try:
                    now = int(time.time())
                    low = now - 120
                    high = now + 1800
                    async with session_scope() as session:
                        # Update matches that are about to start and have no stream_url.
                        # NOTE: stream_url is nullable -> filter only NULL.
                        from sqlalchemy import select, and_

                        q = (
                            select(Match)
                            .where(
                                and_(
                                    Match.category.in_(["dota2", "football"]),
                                    Match.start_time_unix >= low,
                                    Match.start_time_unix <= high,
                                    Match.stream_url.is_(None),
                                )
                            )
                            .order_by(Match.start_time_unix.asc())
                            .limit(6)
                        )
                        res = await session.execute(q)
                        items = list(res.scalars().all())

                        for m in items:
                            url = await asyncio.to_thread(
                                get_twitch_stream_url,
                                m.team1,
                                m.team2,
                                m.tournament,
                            )
                            if url:
                                m.stream_url = url
                        await session.commit()
                except Exception:
                    logger.exception("Twitch scraper loop failed")
                await asyncio.sleep(30)

        asyncio.create_task(_loop())

