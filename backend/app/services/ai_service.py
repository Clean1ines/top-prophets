from __future__ import annotations

import json
import os
from typing import List, Literal

from groq import Groq
from pydantic import BaseModel, Field


EventType = Literal['goal', 'shot', 'pass', 'save', 'foul', 'other']


class EventWindow(BaseModel):
    secondsBefore: float = Field(..., ge=0)
    secondsAfter: float = Field(..., ge=0)


class GeneratedEvent(BaseModel):
    id: str
    type: EventType
    timestamp: float = Field(..., ge=0)
    pointValue: int = Field(..., ge=0)
    window: EventWindow


class GeneratedEventsResponse(BaseModel):
    events: List[GeneratedEvent]


def _get_client() -> Groq:
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        raise RuntimeError('GROQ_API_KEY is not set')
    return Groq(api_key=api_key)


def _build_prompt(match_description: str) -> str:
    return (
        'Act as a football match analyst.\n'
        'Given the match description below, identify 8-12 key moments (goals, big chances, kills/defensive stops, etc.).\n'
        'Return strictly valid JSON matching the schema.\n'
        'All timestamps must be seconds from match start (0-based).\n'
        'The window defines the accepted hit range around each timestamp.\n\n'
        f'MATCH DESCRIPTION:\n{match_description}\n'
    )


async def generate_events(match_description: str) -> GeneratedEventsResponse:
    # NOTE: Groq python sdk is currently synchronous; we still expose async interface for FastAPI.
    client = _get_client()

    schema = GeneratedEventsResponse.model_json_schema()

    prompt = _build_prompt(match_description)

    completion = client.chat.completions.create(
        model='llama-3.3-70b-versatile',
        messages=[
            {
                'role': 'system',
                'content': 'You generate structured JSON only. No extra commentary.',
            },
            {'role': 'user', 'content': prompt},
        ],
        temperature=0.3,
        max_completion_tokens=900,
        response_format={'type': 'json_schema', 'json_schema': schema},
    )

    content = completion.choices[0].message.content or '{}'
    data = json.loads(content)
    return GeneratedEventsResponse.model_validate(data)


# --- Live feed oracle (для /api/admin/validate-live-feed и watcher) ---

LiveEventType = Literal['Goal', 'First Blood', 'Roshan Kill']


class ExtractedLiveEvent(BaseModel):
    event_type: LiveEventType
    actual_time_seconds: int = Field(..., ge=0)


async def extract_actual_event_from_text(text_feed: str) -> ExtractedLiveEvent:
    """
    Извлекает последнее подтвержденное событие из сырого текстового фида.
    В ответе обязан быть строго JSON вида:
      {"event_type":"Goal","actual_time_seconds":1500}
    """
    client = _get_client()

    schema = ExtractedLiveEvent.model_json_schema()
    prompt = (
        'Ты спортивный судья. Проанализируй текст трансляции (сырые заметки / комментаторский текст).\n'
        'Твоя задача: определить тип события и точное время свершившегося события в секундах от начала матча (0-based).\n'
        'Верни строго JSON, используя схему.\n'
        'Если в тексте есть несколько событий, выбери самое позднее подтвержденное (последнее).\n\n'
        f'TEXT FEED:\n{text_feed}'
    )

    completion = client.chat.completions.create(
        model='llama-3.3-70b-versatile',
        messages=[
            {
                'role': 'system',
                'content': 'Ты генератор строго структурированного JSON. Никаких комментариев.',
            },
            {'role': 'user', 'content': prompt},
        ],
        temperature=0.2,
        max_completion_tokens=250,
        response_format={'type': 'json_schema', 'json_schema': schema},
    )

    content = completion.choices[0].message.content or '{}'
    data = json.loads(content)
    return ExtractedLiveEvent.model_validate(data)

