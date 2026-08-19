"""SQLAlchemy engine/session setup.

SQLite by default; PostgreSQL via DATABASE_URL. Bounding-box queries are done
on indexed lat/lng float columns, which is sufficient at province scale
(thousands of parks). PostGIS is an optional later upgrade — see
ARCHITECTURE.md § Spatial strategy.
"""
from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, future=True)

# SQLite ships with foreign-key enforcement OFF per connection; enable it so
# integrity bugs surface in development exactly as they would on PostgreSQL.
if settings.DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _sqlite_fk_on(dbapi_conn, _record):  # pragma: no cover
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
