from __future__ import annotations

import asyncio
import json
import os
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select

from app.core.config import Settings
from app.services.oracle_service import get_actual_event, process_actual_event
from app.database import Match, Prediction, session_scope

logger = logging.getLogger(__name__)

def _load_feed_mapping() -> Dict[str, str]:
    """
    Optional env var:
      LIVE_FEED_URLS_JSON='{"mls-live-1":"https://.../feed","dota-pro-1":"https://.../feed"}'
    """
    raw = os.getenv("LIVE_FEED_URLS_JSON")
    if not raw:
        return {}
    try:
        val = json.loads(raw)
        if isinstance(val, dict):
            return {str(k): str(v) for k, v in val.items()}
    except Exception:
        pass
    return {}


def _env_key_for_match(match_id: str) -> str:
    return "LIVE_FEED_URL_" + match_id.replace("-", "_").replace(".", "_").upper()


def get_feed_url_for_match(match_id: str, mapping: Dict[str, str]) -> Optional[str]:
    if match_id in mapping:
        return mapping[match_id]
    return os.getenv(_env_key_for_match(match_id))


class LiveMonitor:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._stop = False
        self._last_seen: Dict[Tuple[str, str], int] = {}
        self._feed_mapping = _load_feed_mapping()

    async def _fetch_text_feed(self, url: str) -> str:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers={"Accept": "*/*"})
            r.raise_for_status()
            return r.text

    async def run_forever(self, interval_seconds: int = 30) -> None:
        while not self._stop:
            try:
                await self._tick()
            except Exception:
                # Watcher must not crash the service.
                pass

            await asyncio.sleep(interval_seconds)

    async def _tick(self) -> None:
        now = int(datetime.now(timezone.utc).timestamp())
        async with session_scope() as session:
            # Smart watcher: only matches with predictions.
            q = (
                select(Match, func.min(Prediction.predicted_time_seconds))
                .join(Prediction, Prediction.match_id == Match.id)
                .group_by(Match.id)
            )
            rows = (await session.execute(q)).all()

            for match, min_predicted_seconds in rows:
                if min_predicted_seconds is None:
                    continue

                # Start polling only 60 sec before predicted time relative to match start.
                predicted_at_unix = int(match.start_time_unix) + int(min_predicted_seconds)
                if now < (predicted_at_unix - 60):
                    continue

                polling_interval = 5
                feed_url = get_feed_url_for_match(match.id, self._feed_mapping)
                raw_text = None
                if feed_url:
                    try:
                        raw_text = await self._fetch_text_feed(feed_url)
                    except Exception:
                        logger.exception("Feed fetch failed for match=%s", match.id)

                actual = await get_actual_event(match=match, text_feed=raw_text)
                if not actual:
                    continue

                event_type = str(actual["event_type"])
                actual_time_seconds = int(actual["actual_time_seconds"])
                key = (match.id, event_type)
                last_time = self._last_seen.get(key)
                if last_time is not None and actual_time_seconds <= int(last_time):
                    continue

                result = await process_actual_event(
                    session=session,
                    match_id=match.id,
                    event_type=event_type,
                    actual_time_seconds=actual_time_seconds,
                )
                if result.get("new", True):
                    logger.info(
                        "Actual event saved match=%s event=%s t=%s winners=%s",
                        match.id,
                        event_type,
                        actual_time_seconds,
                        len(result.get("winners", [])),
                    )
                    self._last_seen[key] = actual_time_seconds
                await asyncio.sleep(polling_interval)

    def stop(self) -> None:
        self._stop = True


def start_live_monitor(app, settings: Settings) -> None:
    monitor = LiveMonitor(settings)

    async def _runner():
        await monitor.run_forever(interval_seconds=30)

    # Fire-and-forget background task on startup.
    @app.on_event("startup")
    async def _start_background() -> None:
        asyncio.create_task(_runner())

