"""Application entrypoint.

Run (dev):   uvicorn backend.app.main:app --reload
Seed data:   python -m backend.app.seed
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import USE_REMOTE_STORAGE, settings
from .database import Base, engine
from .routes import admin, public, submissions

app = FastAPI(title=settings.APP_NAME, docs_url="/api/docs", openapi_url="/api/openapi.json")

# Create tables on startup (fine for SQLite/dev; use Alembic migrations when
# the schema starts evolving in production — see ARCHITECTURE.md).
Base.metadata.create_all(bind=engine)

app.include_router(public.router)
app.include_router(submissions.router)
app.include_router(admin.router)

# Processed photos. In remote-storage mode they are served straight from
# Supabase, and no upload directory exists here to mount.
if not USE_REMOTE_STORAGE:
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Static frontend (no build step). Mounted last so /api/* wins.
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
