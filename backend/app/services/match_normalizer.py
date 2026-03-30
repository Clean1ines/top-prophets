from __future__ import annotations

import re
from difflib import SequenceMatcher


def normalize_team_name(name: str) -> str:
  """
  Простейшая нормализация:
  - lower
  - убираем все кроме a-z0-9
  - схлопываем подряд идущие разделители
  """
  name = name.lower()
  name = re.sub(r'[^a-z0-9]+', '_', name)
  name = re.sub(r'_+', '_', name).strip('_')
  return name


def team_similarity(a: str, b: str) -> float:
  """Строковое сходство двух уже нормализованных имён (0..1)."""
  return SequenceMatcher(None, a, b).ratio()

