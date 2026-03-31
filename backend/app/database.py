from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional
from contextlib import asynccontextmanager

from sqlalchemy import DateTime, ForeignKey, Integer, String, func, select, UniqueConstraint
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


DATABASE_URL = os.getenv("DATABASE_URL")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    predictions: Mapped[list["Prediction"]] = relationship(back_populates="user")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    match_id: Mapped[str] = mapped_column(String(64), index=True)

    predicted_time_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="predictions")


class ActualEvent(Base):
    __tablename__ = "actual_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id: Mapped[str] = mapped_column(String(64), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    actual_time_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("match_id", "event_type", "actual_time_seconds", name="uq_actual_event"),
    )


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    team1: Mapped[str] = mapped_column(String(255), index=True)
    team2: Mapped[str] = mapped_column(String(255), index=True)
    tournament: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    start_time_unix: Mapped[int] = mapped_column(Integer, index=True)
    status: Mapped[str] = mapped_column(String(32), default="upcoming", index=True)
    stream_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    api_fixture_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


engine: AsyncEngine | None = None
SessionLocal: async_sessionmaker[AsyncSession] | None = None


def _ensure_engine() -> None:
    global engine, SessionLocal
    if engine is not None and SessionLocal is not None:
        return
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")

    db_url = DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Удаляем все параметры строки (включая sslmode)
    if "?" in db_url:
        db_url = db_url.split("?")[0]

    # Никаких connect_args — asyncpg подхватит настройки по умолчанию
    engine = create_async_engine(db_url, future=True, pool_pre_ping=True)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
async def init_db() -> None:
    _ensure_engine()
    assert engine is not None
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_or_create_user(session: AsyncSession, username: str) -> User:
    q = select(User).where(User.username == username)
    res = await session.execute(q)
    user = res.scalars().first()

    if user:
        return user

    user = User(username=username, total_xp=0)
    session.add(user)
    await session.flush()
    return user


async def get_or_create_user_google(session: AsyncSession, *, email: str, name: str) -> User:
    q = select(User).where(User.email == email)
    res = await session.execute(q)
    user = res.scalars().first()
    if user:
        user.name = name or user.name
        if not user.username:
            user.username = email.split("@")[0]
        await session.flush()
        return user

    base_username = email.split("@")[0]
    candidate = base_username
    suffix = 1
    while True:
        q2 = select(User).where(User.username == candidate)
        exists = (await session.execute(q2)).scalars().first()
        if not exists:
            break
        suffix += 1
        candidate = f"{base_username}_{suffix}"

    user = User(username=candidate, email=email, name=name, total_xp=0)
    session.add(user)
    await session.flush()
    return user


async def upsert_match(
    session: AsyncSession,
    *,
    external_key: str,
    team1: str,
    team2: str,
    tournament: str,
    category: str,
    start_time_unix: int,
    status: str = "upcoming",
    stream_url: str | None = None,
    api_fixture_id: str | None = None,
) -> Match:
    q = select(Match).where(Match.external_key == external_key)
    res = await session.execute(q)
    existing = res.scalars().first()
    if existing:
        existing.team1 = team1
        existing.team2 = team2
        existing.tournament = tournament
        existing.category = category
        existing.start_time_unix = int(start_time_unix)
        existing.status = status
        if stream_url is not None:
            existing.stream_url = stream_url
        if api_fixture_id is not None:
            existing.api_fixture_id = str(api_fixture_id)
        await session.flush()
        return existing

    m = Match(
        external_key=external_key,
        team1=team1,
        team2=team2,
        tournament=tournament,
        category=category,
        start_time_unix=int(start_time_unix),
        status=status,
        stream_url=stream_url,
        api_fixture_id=str(api_fixture_id) if api_fixture_id is not None else None,
    )
    session.add(m)
    await session.flush()
    return m


async def iter_session() -> AsyncGenerator[AsyncSession, None]:
    _ensure_engine()
    assert SessionLocal is not None
    async with SessionLocal() as session:
        yield session


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession, None]:
    _ensure_engine()
    assert SessionLocal is not None
    async with SessionLocal() as session:
        yield session