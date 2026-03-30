from __future__ import annotations

from typing import Any, Dict, List
import logging
import os
import time

import httpx

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.database import ActualEvent, Match, Prediction
from app.services.ai_service import extract_actual_event_from_text

logger = logging.getLogger(__name__)
_api_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def compute_points(predicted_time_seconds: int, actual_time_seconds: int) -> int:
    return max(0, 1000 - abs(int(predicted_time_seconds) - int(actual_time_seconds)))


async def _get_api_event_for_match(match: Match) -> dict[str, Any] | None:
    if not match.api_fixture_id:
        return None
    if not os.getenv("RAPID_API_KEY"):
        return None

    cache_key = f"fixture:{match.api_fixture_id}"
    now = time.time()
    cached = _api_cache.get(cache_key)
    if cached and now - cached[0] <= 10:
        return cached[1]

    url = "https://api-football-v1.p.rapidapi.com/v3/fixtures/events"
    headers = {
        "X-RapidAPI-Key": os.getenv("RAPID_API_KEY", ""),
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params={"fixture": match.api_fixture_id}, headers=headers)
        resp.raise_for_status()
        payload = resp.json()
    rows = payload.get("response", []) if isinstance(payload, dict) else []
    if not rows:
        return None
    last = rows[-1]
    typ = str(last.get("type") or "Goal")
    detail = str(last.get("detail") or "").lower()
    minute = int(((last.get("time") or {}).get("elapsed")) or 0)
    sec = minute * 60
    event_type = "Goal" if ("goal" in typ.lower() or "goal" in detail) else typ
    result = {"event_type": event_type, "actual_time_seconds": sec}
    _api_cache[cache_key] = (now, result)
    return result


async def get_actual_event(
    *,
    match: Match,
    text_feed: str | None = None,
) -> dict[str, Any] | None:
    # API-first
    try:
        api_event = await _get_api_event_for_match(match)
        if api_event:
            return api_event
    except Exception:
        logger.exception("API event fetch failed for match=%s", match.id)

    # LLM fallback
    if text_feed:
        try:
            extracted = await extract_actual_event_from_text(text_feed)
            return {
                "event_type": extracted.event_type,
                "actual_time_seconds": int(extracted.actual_time_seconds),
            }
        except Exception:
            logger.exception("LLM fallback extraction failed for match=%s", match.id)

    return None


async def process_actual_event(
    *,
    session,
    match_id: str,
    event_type: str,
    actual_time_seconds: int,
) -> Dict[str, Any]:
    # Idempotency: unique constraint on ActualEvent prevents double scoring.
    actual_event = ActualEvent(
        match_id=match_id,
        event_type=event_type,
        actual_time_seconds=int(actual_time_seconds),
    )
    session.add(actual_event)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        return {"new": False, "winners": []}

    # Load pending predictions for this match + event type.
    q = (
        select(Prediction)
        .where(Prediction.match_id == match_id, Prediction.event_type == event_type)
        .options(selectinload(Prediction.user))
    )
    res = await session.execute(q)
    predictions: List[Prediction] = list(res.scalars().all())

    if not predictions:
        return {"new": True, "winners": []}

    # Aggregate points by user.
    earned_by_user: Dict[str, int] = {}
    for p in predictions:
        points = compute_points(p.predicted_time_seconds, actual_time_seconds)
        earned_by_user[str(p.user.id)] = earned_by_user.get(str(p.user.id), 0) + int(points)

    # Update users and delete predictions (settlement).
    users_by_id = {str(p.user.id): p.user for p in predictions}
    for user_id, earned in earned_by_user.items():
        user = users_by_id.get(user_id)
        if not user:
            continue
        user.total_xp = int(user.total_xp or 0) + int(earned)

    for p in predictions:
        await session.delete(p)

    await session.commit()

    winners = [
        {
            "username": users_by_id[user_id].username,
            "earnedPoints": int(earned),
            "totalXp": int(users_by_id[user_id].total_xp or 0),
        }
        for user_id, earned in earned_by_user.items()
        if int(earned) > 0
    ]
    winners.sort(key=lambda w: w["earnedPoints"], reverse=True)

    return {"new": True, "winners": winners}

