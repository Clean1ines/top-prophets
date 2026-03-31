from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import List


def _split_csv(value: str | None) -> List[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    api_prefix: str
    cors_origins: List[str]

    matches_path: str
    events_path: str

    reference_time_ms: int

    validate_max_seconds_delta: float

    demo_mode: bool


def load_settings() -> Settings:
    api_prefix = os.getenv("API_PREFIX", "").strip()
    if api_prefix and not api_prefix.startswith("/"):
        api_prefix = "/" + api_prefix

    cors_raw = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS") or "*"
    cors_origins = _split_csv(cors_raw)
    matches_path = os.getenv("MATCHES_PATH", os.path.join("data", "matches.json"))
    events_path = os.getenv("EVENTS_PATH", os.path.join("data", "events.json"))

    validate_max_seconds_delta = float(os.getenv("VALIDATE_MAX_SECONDS_DELTA", "5"))

    demo_raw = (os.getenv("DEMO_MODE") or "").strip().lower()
    demo_mode = demo_raw in {"1", "true", "yes", "on"}

    # Fixed "reference time" set when the backend starts.
    reference_time_ms = int(os.getenv("REFERENCE_TIME_MS", "0")) or int(time.time() * 1000)

    return Settings(
        api_prefix=api_prefix,
        cors_origins=cors_origins,
        matches_path=matches_path,
        events_path=events_path,
        reference_time_ms=reference_time_ms,
        validate_max_seconds_delta=validate_max_seconds_delta,
        demo_mode=demo_mode,
    )

