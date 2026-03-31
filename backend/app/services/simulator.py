from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from pydantic import BaseModel

from app.core.config import Settings
from app.database import ActualEvent, session_scope
from app.services.ai_service import extract_actual_event_from_text
from app.services.oracle_service import process_actual_event


class DemoTimelineItem(BaseModel):
  video_time_seconds: int
  text: str


class DemoMatchConfig(BaseModel):
  id: str
  title: str
  # sport делаем необязательным, чтобы не падать на старых версиях demo_matches.json
  sport: str | None = None
  status: str
  stream_url: str
  timeline: List[DemoTimelineItem]


_demo_matches_cache: Dict[str, DemoMatchConfig] = {}
# В проде рабочая директория — backend/, поэтому берём относительный путь data/demo_matches.json
_demo_matches_path = Path("data/demo_matches.json")


def load_demo_matches() -> Dict[str, DemoMatchConfig]:
  global _demo_matches_cache
  if _demo_matches_cache:
    return _demo_matches_cache
  if not _demo_matches_path.exists():
    return {}
  raw = json.loads(_demo_matches_path.read_text(encoding="utf-8"))
  items = [DemoMatchConfig(**m) for m in raw]
  _demo_matches_cache = {m.id: m for m in items}
  return _demo_matches_cache


@dataclass
class DemoClock:
  start_monotonic: float

  def now_video_seconds(self, match: DemoMatchConfig) -> int:
    # Виртуальное время видео = t0 + (текущее_монотоник - старт_монотоник)
    if not match.timeline:
      return 0
    t0 = int(match.timeline[0].video_time_seconds)
    delta = time.monotonic() - self.start_monotonic
    return int(t0 + max(0, delta))


async def start_demo_simulator(app, settings: Settings) -> None:
  if not settings.demo_mode:
    return

  matches = load_demo_matches()
  if not matches:
    return

  clock = DemoClock(start_monotonic=time.monotonic())
  dispatched: Dict[str, set[int]] = {m_id: set() for m_id in matches.keys()}

  async def _loop() -> None:
    while True:
      try:
        for match_id, cfg in matches.items():
          now_vs = clock.now_video_seconds(cfg)
          for item in cfg.timeline:
            if item.video_time_seconds > now_vs:
              continue
            if item.video_time_seconds in dispatched[match_id]:
              continue
            dispatched[match_id].add(item.video_time_seconds)

            extracted = await extract_actual_event_from_text(item.text)
            async with session_scope() as session:
              # Запишем actual_event, чтобы /api/events/latest работал из коробки.
              ev = ActualEvent(
                match_id=match_id,
                event_type=extracted.event_type,
                actual_time_seconds=int(extracted.actual_time_seconds),
              )
              session.add(ev)
              await session.flush()

              # Применим Oracle (начисление XP).
              await process_actual_event(
                session=session,
                match_id=match_id,
                event_type=extracted.event_type,
                actual_time_seconds=int(extracted.actual_time_seconds),
              )
              await session.commit()
      except Exception:
        # В демо-режиме не даём циклу падать.
        pass

      await asyncio.sleep(1)

  @app.on_event("startup")
  async def _start_demo_loop() -> None:
    asyncio.create_task(_loop())

