import base64
import hashlib
import hmac
import os
import time
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


def is_banned(ip: str) -> bool:
    conn = get_conn()
    row = conn.execute(
        "SELECT banned FROM login_security WHERE ip = ?", (ip,)
    ).fetchone()
    conn.close()
    return bool(row and row["banned"])


def record_failed_attempt(ip: str) -> bool:
    """Increments the failed-attempt counter for `ip`. Returns True if this
    attempt caused the IP to become banned."""
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO login_security (ip, failed_attempts, banned)
        VALUES (?, 1, 0)
        ON CONFLICT(ip) DO UPDATE SET failed_attempts = failed_attempts + 1
        """,
        (ip,),
    )
    row = conn.execute(
        "SELECT failed_attempts FROM login_security WHERE ip = ?", (ip,)
    ).fetchone()
    just_banned = False
    if row and row["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
        conn.execute("UPDATE login_security SET banned = 1 WHERE ip = ?", (ip,))
        just_banned = True
    conn.commit()
    conn.close()
    return just_banned


def reset_attempts(ip: str) -> None:
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO login_security (ip, failed_attempts, banned) VALUES (?, 0, 0)",
        (ip,),
    )
    conn.commit()
    conn.close()
