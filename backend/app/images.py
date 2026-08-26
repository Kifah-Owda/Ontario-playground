"""Image pipeline: validate, auto-resize, compress, strip metadata.

Owner requirements implemented here:
  - up to MAX_PHOTOS_PER_SUBMISSION images per park submission (enforced in route)
  - automatic resize/compress (users never resize manually)
  - storage-cost optimisation: re-encode to WebP q~80, long edge capped at
    IMAGE_MAX_DIMENSION, plus a small thumbnail for lists/popups
  - privacy: re-encoding drops EXIF (including GPS) from stored files
"""
from __future__ import annotations

import io
import secrets
import sys

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import USE_REMOTE_STORAGE, settings

ALLOWED_INPUT_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP", "TIFF"}

# Supabase serves public buckets through a CDN, and on the free plan a delete
# does NOT purge the edge cache — the object keeps being served until this TTL
# expires. Object names are random hex, so content never goes stale and a long
# TTL would be safe for correctness; the limit here exists so that "Delete
# permanently" actually stops serving the photo within the hour. One hour is
# also Supabase's own default. Accidental removals are covered by Reject,
# which keeps the row and its photos untouched.
_CACHE_CONTROL = "public, max-age=3600"
_STORAGE_TIMEOUT = 30.0


class ImageError(ValueError):
    pass


def _object_endpoint(key: str) -> str:
    return (
        f"{settings.SUPABASE_URL}/storage/v1/object/"
        f"{settings.SUPABASE_BUCKET}/{key}"
    )


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"}


def _put_object(key: str, data: bytes) -> None:
    """Upload one processed image to Supabase Storage. Raises on failure."""
    resp = httpx.post(
        _object_endpoint(key),
        content=data,
        headers={
            **_auth_headers(),
            "Content-Type": "image/webp",
            "Cache-Control": _CACHE_CONTROL,
        },
        timeout=_STORAGE_TIMEOUT,
    )
    resp.raise_for_status()


def _delete_object(key: str) -> None:
    """Delete one object. A 404 is success — the goal is that it is gone."""
    resp = httpx.delete(
        _object_endpoint(key), headers=_auth_headers(), timeout=_STORAGE_TIMEOUT
    )
    if resp.status_code != 404:
        resp.raise_for_status()


def _encode(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=quality, method=4)
    return buf.getvalue()


def _store(key: str, data: bytes) -> None:
    if USE_REMOTE_STORAGE:
        _put_object(key, data)
    else:
        (settings.UPLOAD_DIR / key).write_bytes(data)


def process_upload(raw: bytes, original_name: str | None) -> dict:
    """Validate and store one uploaded image. Returns metadata dict."""
    if len(raw) > settings.MAX_UPLOAD_BYTES:
        raise ImageError(
            f"Image too large ({len(raw) // (1024 * 1024)} MB). "
            f"Limit is {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
        )
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise ImageError("File is not a readable image.")
    if (img.format or "").upper() not in ALLOWED_INPUT_FORMATS:
        raise ImageError(f"Unsupported image format: {img.format}")

    # Respect device orientation, then discard EXIF by re-encoding.
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    token = secrets.token_hex(8)
    filename = f"{token}.webp"
    thumb_filename = f"{token}_thumb.webp"

    main = img.copy()
    main.thumbnail((settings.IMAGE_MAX_DIMENSION, settings.IMAGE_MAX_DIMENSION))
    main_bytes = _encode(main, settings.IMAGE_QUALITY)

    thumb = img.copy()
    thumb.thumbnail((settings.IMAGE_THUMB_DIMENSION, settings.IMAGE_THUMB_DIMENSION))
    thumb_bytes = _encode(thumb, 70)

    # Write the pair, and undo the first write if the second fails: a half
    # stored photo would leave an object no database row ever references.
    _store(filename, main_bytes)
    try:
        _store(thumb_filename, thumb_bytes)
    except Exception:
        delete_files(filename, "")
        raise

    return {
        "filename": filename,
        "thumb_filename": thumb_filename,
        "original_name": (original_name or "")[:255] or None,
        "width": main.width,
        "height": main.height,
        "bytes": len(main_bytes),
    }


def delete_files(filename: str, thumb_filename: str) -> None:
    """Remove a photo's processed files from wherever they live. Missing files
    are fine; other errors are logged but never fail the caller (an orphaned
    file is recoverable, a failed admin request is not)."""
    for name in (filename, thumb_filename):
        if not name:
            continue
        try:
            if USE_REMOTE_STORAGE:
                _delete_object(name)
            else:
                (settings.UPLOAD_DIR / name).unlink(missing_ok=True)
        except (OSError, httpx.HTTPError) as exc:  # pragma: no cover
            print(f"WARNING: could not delete upload {name}: {exc}", file=sys.stderr)
