import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from core.dbutils import engine
from models import models
from routers import presentations, documents, dashboard_auth

# 🔐 auth imports
from auth.db import create_db_and_tables
from auth.schemas import UserRead, UserCreate, UserUpdate
from auth.users import (
    auth_backend,
    fastapi_users,
    current_active_user,   # useful for protected routes later
    github_oauth_client,
    google_oauth_client,
    SECRET,
)

# Frontend URL for redirects after OAuth
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(title="AI PPT & Document Generator API")

# ========= 🗄 EXISTING SQLALCHEMY TABLES (PPT/DOC PART) =========
models.Base.metadata.create_all(bind=engine)

# ========= 🌐 CORS =========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later you can set [FRONTEND_URL]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Welcome to PPT & Document Generator API"}


# ========= 🔐 AUTH ROUTES =========

# 1) Email/password JWT login
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)

# 2) Register with email + password
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)

# 3) Users CRUD (/users/me, /users/{id}, etc.)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# 4) GitHub OAuth login
app.include_router(
    fastapi_users.get_oauth_router(
        github_oauth_client,
        auth_backend,
        SECRET,  # state_secret
        associate_by_email=True,
        is_verified_by_default=True,
        redirect_url=f"{FRONTEND_URL}/oauth-complete",  # 👈 send back to frontend
    ),
    prefix="/auth/github",
    tags=["auth"],
)

# 5) Google OAuth login
app.include_router(
    fastapi_users.get_oauth_router(
        google_oauth_client,
        auth_backend,
        SECRET,  # state_secret
        associate_by_email=True,
        is_verified_by_default=True,
        redirect_url=f"{FRONTEND_URL}/oauth-complete",  # 👈 same redirect
    ),
    prefix="/auth/google",
    tags=["auth"],
)


# ========= 📝 YOUR EXISTING BUSINESS ROUTES =========

# PPT router
app.include_router(
    presentations.router,
    prefix="/api/v1/presentations",
    tags=["presentations"],
)

# DOCX router
app.include_router(
    documents.router,
    prefix="/api/v1/documents",
    tags=["documents"],
)

# DASHBOARD router (list all docs + ppts)
# router prefix="/dashboard" -> final path = /api/v1/dashboard/items
app.include_router(
    dashboard_auth.router,
    prefix="/api/v1",
    tags=["dashboard"],
)


# ========= 🚀 STARTUP HOOK =========

@app.on_event("startup")
async def on_startup():
    # create auth tables (User + OAuthAccount) in ppt_generator.db (async engine)
    await create_db_and_tables()


if __name__ == "__main__":
    # use 8000 so it matches uvicorn default & your frontend API_BASE
    uvicorn.run(app, host="0.0.0.0", port=8000)
