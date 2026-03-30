from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from app.core.config import Settings


class GameEventWindow(BaseModel):
    secondsBefore: float
    secondsAfter: float


class GameEvent(BaseModel):
    id: str
    type: str
    timestamp: float
    pointValue: int
    window: GameEventWindow


class MatchType(str):
    pass


class Match(BaseModel):
    id: str
    title: str
    type: str
    # New match config fields (LIVE embeds).
    streamId: Optional[str] = None
    channelHandle: Optional[str] = None
    category: Optional[str] = None

    # Legacy fields (kept optional for prototype compatibility).
    streamUrl: Optional[str] = None
    startedAtOffsetSeconds: Optional[float] = None
    liveTextMessages: Optional[List[str]] = None
    events: List[GameEvent] = Field(default_factory=list)


class MatchesResponse(BaseModel):
    referenceTimeMs: int
    startTimeUnix: float
    matches: List[Match]


class ValidateRequest(BaseModel):
    matchId: str
    userTimeSeconds: float
    username: Optional[str] = 'guest'


class ValidateResponse(BaseModel):
    success: bool
    matchedEvent: Optional[GameEvent] = None
    earnedPoints: int = 0
    userScore: int = 0
    deltaSeconds: Optional[float] = None


class LeaderboardEntry(BaseModel):
    id: str
    username: str
    score: int


class LiveEngine:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.reference_time_ms: int = settings.reference_time_ms

        self._matches_meta: Dict[str, dict] = {}
        self._events_by_match: Dict[str, List[GameEvent]] = {}

        # Leaderboard (in-memory).
        self._leaderboard_scores: Dict[str, int] = {}
        # Prevent rewarding duplicates per (username, matchId, eventId).
        self._rewarded_keys: set[str] = set()
        self._lock = threading.Lock()

        self._load_configs()

    def reload_configs(self) -> None:
        """Reload matches/events configs from disk (used by admin endpoints)."""
        self._load_configs()

    def _load_configs(self) -> None:
        matches_path = Path(self.settings.matches_path)
        events_path = Path(self.settings.events_path)

        if not matches_path.exists():
            raise FileNotFoundError(f"Missing matches config: {matches_path}")
        if not events_path.exists():
            raise FileNotFoundError(f"Missing events config: {events_path}")

        with matches_path.open('r', encoding='utf-8') as f:
            matches_raw = json.load(f)

        # matches.json expects either a list or a map.
        if isinstance(matches_raw, list):
            matches_meta = {m['id']: m for m in matches_raw}
        else:
            matches_meta = matches_raw
        self._matches_meta = matches_meta

        with events_path.open('r', encoding='utf-8') as f:
            events_raw = json.load(f)

        events_by_match: Dict[str, List[GameEvent]] = {}
        for match_id, events_list in events_raw.items():
            events_by_match[match_id] = [GameEvent(**e) for e in events_list]
        self._events_by_match = events_by_match

    def get_matches(self) -> MatchesResponse:
        matches: List[Match] = []
        for match_id, meta in self._matches_meta.items():
            matches.append(
                Match(
                    id=meta['id'],
                    title=meta.get('title', meta['id']),
                    type=meta.get('type', 'text'),
                    streamId=meta.get('streamId'),
                    channelHandle=meta.get('channelHandle'),
                    category=meta.get('category'),

                    streamUrl=meta.get('streamUrl'),
                    startedAtOffsetSeconds=float(meta.get('startedAtOffsetSeconds', 0))
                    if meta.get('startedAtOffsetSeconds') is not None
                    else None,
                    liveTextMessages=meta.get('liveTextMessages'),
                    events=self._events_by_match.get(match_id, []),
                )
            )

        return MatchesResponse(
            referenceTimeMs=self.reference_time_ms,
            startTimeUnix=float(self.reference_time_ms) / 1000.0,
            matches=matches,
        )

    def _is_in_window(self, event: GameEvent, user_time_seconds: float) -> Tuple[bool, float]:
        delta = user_time_seconds - float(event.timestamp)
        min_t = float(event.timestamp) - float(event.window.secondsBefore)
        max_t = float(event.timestamp) + float(event.window.secondsAfter)
        return (min_t <= user_time_seconds <= max_t, delta)

    def validate(self, match_id: str, user_time_seconds: float, username: str) -> ValidateResponse:
        events = self._events_by_match.get(match_id)
        if not events:
            return ValidateResponse(success=False, earnedPoints=0, userScore=self._leaderboard_scores.get(username, 0))

        best_event: Optional[GameEvent] = None
        best_delta_abs: Optional[float] = None
        best_delta: Optional[float] = None

        for e in events:
            ok, delta = self._is_in_window(e, user_time_seconds)
            if not ok:
                continue
            ad = abs(delta)
            if best_delta_abs is None or ad < best_delta_abs:
                best_event = e
                best_delta_abs = ad
                best_delta = delta

        with self._lock:
            current_score = self._leaderboard_scores.get(username, 0)
            if not best_event:
                return ValidateResponse(
                    success=False,
                    matchedEvent=None,
                    earnedPoints=0,
                    userScore=current_score,
                    deltaSeconds=best_delta,
                )

            reward_key = f"{username}:{match_id}:{best_event.id}"
            already_rewarded = reward_key in self._rewarded_keys

            if already_rewarded:
                # Count as a "success", but no XP to avoid farming.
                return ValidateResponse(
                    success=True,
                    matchedEvent=best_event,
                    earnedPoints=0,
                    userScore=current_score,
                    deltaSeconds=best_delta,
                )

            self._rewarded_keys.add(reward_key)
            earned = int(best_event.pointValue)
            self._leaderboard_scores[username] = current_score + earned

            return ValidateResponse(
                success=True,
                matchedEvent=best_event,
                earnedPoints=earned,
                userScore=current_score + earned,
                deltaSeconds=best_delta,
            )

    def get_leaderboard(self, limit: int = 50) -> List[LeaderboardEntry]:
        with self._lock:
            items = sorted(self._leaderboard_scores.items(), key=lambda kv: kv[1], reverse=True)

        top = items[:limit]
        return [
            LeaderboardEntry(id=f"lb_{idx}", username=username, score=score)
            for idx, (username, score) in enumerate(top)
        ]

