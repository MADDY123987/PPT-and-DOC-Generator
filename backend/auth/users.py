# backend/auth/users.py
import os
import uuid
from typing import AsyncGenerator, Optional

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, models
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.clients.google import GoogleOAuth2

from .db import User, get_user_db

# ----------------- CORE CONFIG -----------------

# Read from env in real project; fallback only for dev
SECRET = os.getenv("SECRET", "CHANGE_THIS_SUPER_SECRET_123456")

# GitHub OAuth
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")

github_oauth_client = GitHubOAuth2(
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
)

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

google_oauth_client = GoogleOAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
)

# ----------------- USER MANAGER -----------------


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    """
    Minimal user manager:
    - normal register + login (JWT)
    - GitHub / Google OAuth support
    - NO email verification or reset-password emails
    """

    async def on_after_register(
        self, user: User, request: Optional[Request] = None
    ) -> None:
        # Just log to console so you see when a user registers.
        print(f"User {user.id} registered with email {user.email}")


async def get_user_manager(
    user_db: SQLAlchemyUserDatabase = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db)


# ----------------- AUTH BACKEND (JWT) -----------------

# This is the "normal" username/password login transport: /auth/jwt/login
bearer_transport = BearerTransport(tokenUrl="/auth/jwt/login")


def get_jwt_strategy() -> JWTStrategy[models.UP, models.ID]:
    # JWT lifetime is 1 hour (3600 seconds) – adjust if you want
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

# Main FastAPI Users object – used to generate routers
fastapi_users = FastAPIUsers[User, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

# Dependency to get the current authenticated user
current_active_user = fastapi_users.current_user(active=True)
