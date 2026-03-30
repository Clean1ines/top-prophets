"""
Mock AI generator for match events JSON.

Run:
  python scripts/generate_events.py --matchId match_1

If you later integrate a real Gemini model, replace `generate_events()` implementation.
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List


@dataclass
class Window:
    secondsBefore: float
    secondsAfter: float


@dataclass
class Event:
    id: str
    type: str
    timestamp: float
    pointValue: int
    window: Window


def generate_events(seed: int = 42) -> List[Event]:
    rng = random.Random(seed)
    base = [10, 18, 27, 36, 45, 54]
    types = ["goal", "shot", "pass", "save", "foul", "other"]

    events: List[Event] = []
    for i, t in enumerate(base[:5], start=1):
        et = types[i - 1]
        pv = {"goal": 10, "shot": 6, "pass": 4, "save": 5, "foul": 2, "other": 2}[et]
        wb = rng.choice([3, 4, 5])
        wa = rng.choice([3, 4, 5])
        events.append(
            Event(
                id=f"e_auto_{i}",
                type=et,
                timestamp=float(t),
                pointValue=int(pv),
                window=Window(secondsBefore=float(wb), secondsAfter=float(wa)),
            )
        )
    return events


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matchId", required=True)
    parser.add_argument("--out", default=str(Path("data") / "events.json"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    events = generate_events(seed=args.seed)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if out_path.exists():
        raw: Dict[str, List[dict]] = json.loads(out_path.read_text(encoding="utf-8"))
    else:
        raw = {}

    raw[args.matchId] = [asdict(e) | {"window": asdict(e.window)} for e in events]

    out_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Written {len(events)} events for {args.matchId} -> {out_path}")


if __name__ == "__main__":
    main()

