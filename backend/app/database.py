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

def _normalise_url(url: str) -> str:
    """Make a pasted Postgres URL usable as-is.

    Supabase (and most hosts) hand out `postgresql://...`, which SQLAlchemy
    resolves to psycopg2 — a driver we do not install. Rewrite it to name
    psycopg 3 explicitly rather than relying on the operator pasting the right
    prefix into a dashboard field. Also require TLS, which Supabase expects.
    """
    if url.startswith("postgres://"):  # legacy Heroku-style prefix
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    if url.startswith("postgresql+psycopg://") and "sslmode=" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


DATABASE_URL = _normalise_url(settings.DATABASE_URL)
IS_SQLITE = DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if IS_SQLITE else {}
engine_kwargs: dict = {}
if not IS_SQLITE:
    # Supabase's pooler drops idle connections. Without pre-ping, the first
    # request after a quiet spell gets a dead connection and 500s; recycling
    # keeps us from holding one long enough to be culled mid-use.
    engine_kwargs = {"pool_pre_ping": True, "pool_recycle": 300}

engine = create_engine(
    DATABASE_URL, connect_args=connect_args, future=True, **engine_kwargs
)

# SQLite ships with foreign-key enforcement OFF per connection; enable it so
# integrity bugs surface in development exactly as they would on PostgreSQL.
if IS_SQLITE:

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
