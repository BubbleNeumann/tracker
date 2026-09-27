import base64
import hashlib
import hmac
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from db import get_conn

MAX_FAILED_ATTEMPTS = 2
COOKIE_NAME = "tracker_session"
SESSION_MAX_AGE = 100 * 365 * 24 * 3600  # effectively "forever"

SECRET_KEY_PATH = Path(__file__).parent / "data" / "secret.key"


def _load_secret_key() -> bytes:
    env_key = os.environ.get("TRACKER_SECRET_KEY")
    if env_key:
        return env_key.encode("utf-8")

    SECRET_KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SECRET_KEY_PATH.exists():
        return SECRET_KEY_PATH.read_bytes()

    key = os.urandom(32)
    SECRET_KEY_PATH.write_bytes(key)
    return key


SECRET_KEY = _load_secret_key()


def _sign(value: str) -> str:
    return hmac.new(SECRET_KEY, value.encode("utf-8"), hashlib.sha256).hexdigest()


def make_session_token(username: str) -> str:
    expires_at = int(time.time()) + SESSION_MAX_AGE
    payload = f"{username}:{expires_at}"
    encoded = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")
    signature = _sign(encoded)
    return f"{encoded}.{signature}"


def verify_session_token(token: str) -> str | None:
    try:
        encoded, signature = token.split(".", 1)
    except ValueError:
        return None

    if not hmac.compare_digest(_sign(encoded), signature):
        return None

    try:
        payload = base64.urlsafe_b64decode(encoded.encode("utf-8")).decode("utf-8")
        username, expires_at = payload.rsplit(":", 1)
        expires_at = int(expires_at)
    except (ValueError, UnicodeDecodeError):
        return None

    if time.time() > expires_at:
        return None

    return username


def compute_fingerprint(user_agent: str, accept_language: str) -> str:
    """A lightweight, header-based stand-in for a device identity. Not
    cryptographically robust (headers can be spoofed), but cheap to check
    and enough to catch the common case of a banned client just switching
    IP address without changing browser/device."""
    raw = f"{user_agent}|{accept_language}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_banned(ip: str, fingerprint: str) -> bool:
    conn = get_conn()
    row = conn.execute(
        """
        SELECT 1 FROM login_security
        WHERE banned = 1 AND (ip = ? OR device_fingerprint = ?)
        LIMIT 1
        """,
        (ip, fingerprint),
    ).fetchone()
    conn.close()
    return row is not None


def record_failed_attempt(ip: str, fingerprint: str) -> bool:
    """Increments the failed-attempt counter for `ip`. Returns True if this
    attempt caused the IP to become banned."""
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO login_security (ip, failed_attempts, banned, device_fingerprint)
        VALUES (?, 1, 0, ?)
        ON CONFLICT(ip) DO UPDATE SET
            failed_attempts = failed_attempts + 1,
            device_fingerprint = excluded.device_fingerprint
        """,
        (ip, fingerprint),
    )
    row = conn.execute(
        "SELECT failed_attempts FROM login_security WHERE ip = ?", (ip,)
    ).fetchone()
    just_banned = False
    if row and row["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
        conn.execute(
            "UPDATE login_security SET banned = 1, banned_at = ? WHERE ip = ?",
            (datetime.now(timezone.utc).isoformat(timespec="seconds"), ip),
        )
        just_banned = True
    conn.commit()
    conn.close()
    return just_banned


def reset_attempts(ip: str) -> None:
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO login_security (ip, failed_attempts, banned)
        VALUES (?, 0, 0)
        ON CONFLICT(ip) DO UPDATE SET failed_attempts = 0, banned = 0, banned_at = NULL
        """,
        (ip,),
    )
    conn.commit()
    conn.close()
