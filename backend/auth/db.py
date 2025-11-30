# backend/auth/db.py
from collections.abc import AsyncGenerator
from typing import List

from fastapi import Depends
from fastapi_users_db_sqlalchemy import (
    SQLAlchemyBaseUserTableUUID,
    SQLAlchemyBaseOAuthAccountTableUUID,
    SQLAlchemyUserDatabase,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, relationship

DATABASE_URL = "sqlite+aiosqlite:///./ppt_generator.db"


class Base(DeclarativeBase):
    pass


class OAuthAccount(SQLAlchemyBaseOAuthAccountTableUUID, Base):
    """Table to store linked OAuth accounts (GitHub etc.)."""
    pass


class User(SQLAlchemyBaseUserTableUUID, Base):
    """Main user table."""
    oauth_accounts: Mapped[List[OAuthAccount]] = relationship(
        "OAuthAccount", lazy="joined"
    )


engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def create_db_and_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_user_db(
    session: AsyncSession = Depends(get_async_session),
) -> AsyncGenerator[SQLAlchemyUserDatabase, None]:
    # Note: we pass User AND OAuthAccount here
    yield SQLAlchemyUserDatabase(session, User, OAuthAccount)
