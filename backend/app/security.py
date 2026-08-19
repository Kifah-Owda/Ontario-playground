"""Security utilities: single-admin HMAC tokens + in-memory rate limiter.

Deliberately dependency-free (stdlib hmac/hashlib). One admin credential set
via ADMIN_PASSWORD; tokens are `<expiry-unix>.<hex hmac(SECRET_KEY, expiry)>`.
Good enough for a one-moderator civic app; swap for a real auth provider later
if multiple moderators are needed (see ARCHITECTURE.md § Auth).
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

_bearer = HTTPBearer(auto_error=False)


def _sign(payload: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()


def issue_admin_token() -> str:
    expiry = str(int(time.time()) + settings.ADMIN_TOKEN_TTL_SECONDS)
    return f"{expiry}.{_sign(expiry)}"


def verify_password(candidate: str) -> bool:
    if not settings.ADMIN_PASSWORD:
        # Refuse logins until an admin password is configured.
        return False
    return secrets.compare_digest(candidate, settings.ADMIN_PASSWORD)


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Admin token required")
    token = credentials.credentials
    try:
        expiry, signature = token.split(".", 1)
    except ValueError:
        raise HTTPException(status_code=401, detail="Malformed token")
    if not hmac.compare_digest(signature, _sign(expiry)):
        raise HTTPException(status_code=401, detail="Invalid token")
    if int(expiry) < time.time():
        raise HTTPException(status_code=401, detail="Token expired — sign in again")


# --- Simple sliding-window rate limiter (per process, per IP) ----------------
_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limit_submission(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    window = 3600.0
    now = time.time()
    q = _hits[ip]
    while q and q[0] < now - window:
        q.popleft()
    if len(q) >= settings.SUBMISSIONS_PER_HOUR_PER_IP:
        raise HTTPException(
            status_code=429,
            detail="Too many submissions from this connection — try again later.",
        )
    q.append(now)
