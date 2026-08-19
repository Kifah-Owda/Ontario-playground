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

from PIL import Image, ImageOps, UnidentifiedImageError

from .config import settings

ALLOWED_INPUT_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP", "TIFF"}


class ImageError(ValueError):
    pass


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
    main_path = settings.UPLOAD_DIR / filename
    main.save(main_path, "WEBP", quality=settings.IMAGE_QUALITY, method=4)

    thumb = img.copy()
    thumb.thumbnail((settings.IMAGE_THUMB_DIMENSION, settings.IMAGE_THUMB_DIMENSION))
    thumb.save(settings.UPLOAD_DIR / thumb_filename, "WEBP", quality=70, method=4)

    return {
        "filename": filename,
        "thumb_filename": thumb_filename,
        "original_name": (original_name or "")[:255] or None,
        "width": main.width,
        "height": main.height,
        "bytes": main_path.stat().st_size,
    }


def delete_files(filename: str, thumb_filename: str) -> None:
    """Remove a photo's processed files from disk. Missing files are fine;
    other filesystem errors are logged but never fail the caller (an orphaned
    file is recoverable, a failed admin request is not)."""
    for name in (filename, thumb_filename):
        if not name:
            continue
        try:
            (settings.UPLOAD_DIR / name).unlink(missing_ok=True)
        except OSError as exc:  # pragma: no cover
            print(f"WARNING: could not delete upload {name}: {exc}", file=sys.stderr)
