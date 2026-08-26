"""Application configuration.

Values come from environment variables. A `.env` file in the project root is
loaded automatically at import time (real environment variables always take
precedence over the file). No credentials are hard-coded; see MANUAL_SETUP.md.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]  # project root

# Load .env (no-op if the file doesn't exist). load_dotenv never overrides
# variables already present in the process environment, so values set in a
# host's dashboard / shell exports win over the file. Guarded import so an
# existing venv that predates this dependency still boots (with a hint).
try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:  # pragma: no cover
    if (BASE_DIR / ".env").exists():
        print(
            "WARNING: a .env file exists but python-dotenv is not installed — "
            "run `pip install -r requirements.txt` to have it loaded.",
            file=sys.stderr,
        )


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    # --- Core -------------------------------------------------------------
    APP_NAME: str = "Ontario Playground Finder"
    # SQLite by default (free, zero-setup). Set DATABASE_URL to a
    # postgresql+psycopg:// URL for production. See MANUAL_SETUP.md.
    DATABASE_URL: str = _env(
        "DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'app.db'}"
    )
    # Secret used to sign admin session tokens. MUST be set in production.
    SECRET_KEY: str = _env("SECRET_KEY", "dev-only-change-me")
    # Single-admin password for the moderation console. MUST be set.
    ADMIN_PASSWORD: str = _env("ADMIN_PASSWORD", "")
    ADMIN_TOKEN_TTL_SECONDS: int = int(_env("ADMIN_TOKEN_TTL_SECONDS", "43200"))  # 12h

    # --- Uploads / images ---------------------------------------------------
    UPLOAD_DIR: Path = Path(_env("UPLOAD_DIR", str(BASE_DIR / "data" / "uploads")))
    MAX_PHOTOS_PER_SUBMISSION: int = int(_env("MAX_PHOTOS_PER_SUBMISSION", "10"))
    MAX_UPLOAD_BYTES: int = int(_env("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))  # 15 MB raw
    IMAGE_MAX_DIMENSION: int = int(_env("IMAGE_MAX_DIMENSION", "1600"))
    IMAGE_THUMB_DIMENSION: int = int(_env("IMAGE_THUMB_DIMENSION", "480"))
    IMAGE_QUALITY: int = int(_env("IMAGE_QUALITY", "80"))  # WebP quality

    # --- Remote photo storage (Supabase Storage) --------------------------
    # Unset locally: photos are written to UPLOAD_DIR and served from
    # /uploads, exactly as before. Set in production: photos live in a public
    # Supabase bucket and the DB stores the object key in the same
    # filename/thumb_filename columns, so no migration is involved.
    SUPABASE_URL: str = _env("SUPABASE_URL", "").rstrip("/")
    SUPABASE_SERVICE_KEY: str = _env("SUPABASE_SERVICE_KEY", "")
    SUPABASE_BUCKET: str = _env("SUPABASE_BUCKET", "park-photos")

    # --- Anti-abuse -----------------------------------------------------------
    SUBMISSIONS_PER_HOUR_PER_IP: int = int(_env("SUBMISSIONS_PER_HOUR_PER_IP", "10"))

    # --- Frontend runtime config (exposed via /api/meta) ----------------------
    # Tile layer: OSM default (free; observe usage policy). Optionally swap in
    # any XYZ provider; key placeholders documented in MANUAL_SETUP.md.
    TILE_URL: str = _env(
        "TILE_URL", "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    )
    TILE_ATTRIBUTION: str = _env(
        "TILE_ATTRIBUTION",
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    )
    # Optional Nominatim geocoding endpoint for the address search box in the
    # submission form. Leave enabled for the public endpoint (rate-limited,
    # attribution required) or point at your own instance.
    GEOCODER_URL: str = _env("GEOCODER_URL", "https://nominatim.openstreetmap.org/search")
    GEOCODER_ENABLED: bool = _env_bool("GEOCODER_ENABLED", True)

    # Map start view: centre of Southern Ontario.
    MAP_START_LAT: float = float(_env("MAP_START_LAT", "43.85"))
    MAP_START_LNG: float = float(_env("MAP_START_LNG", "-79.55"))
    MAP_START_ZOOM: int = int(_env("MAP_START_ZOOM", "8"))


settings = Settings()

# Remote storage is on only when BOTH halves of the credential are present —
# a half-configured environment falls back to local disk rather than failing
# every upload at runtime.
USE_REMOTE_STORAGE: bool = bool(
    settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY
)


def storage_object_url(key: str) -> str:
    """Public URL for a stored photo, in whichever mode is active."""
    if USE_REMOTE_STORAGE:
        return (
            f"{settings.SUPABASE_URL}/storage/v1/object/public/"
            f"{settings.SUPABASE_BUCKET}/{key}"
        )
    return f"/uploads/{key}"


# Only needed when photos live on this machine; in remote mode there is no
# upload directory to create (and on Render nothing writable to create it in).
if not USE_REMOTE_STORAGE:
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Loud, non-fatal warnings for the two values everything else depends on.
if settings.SECRET_KEY == "dev-only-change-me":
    print(
        "WARNING: SECRET_KEY is the insecure default. Set SECRET_KEY in .env "
        "or the environment before exposing this app (see MANUAL_SETUP.md).",
        file=sys.stderr,
    )
if not settings.ADMIN_PASSWORD:
    print(
        "WARNING: ADMIN_PASSWORD is not set — moderator sign-in is disabled. "
        "Set it in .env or the environment (see MANUAL_SETUP.md).",
        file=sys.stderr,
    )
