from fastapi import APIRouter, HTTPException

from db import get_conn
from helpers import get_or_create_tag, now_iso, serialize_entry
from models import TimerStart

router = APIRouter(prefix="/api/timer", tags=["timer"])


@router.get("/current")
def current_timer():
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM entries WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1"
    ).fetchone()
    result = serialize_entry(conn, row) if row else None
    conn.close()
    return result


@router.post("/start")
def start_timer(payload: TimerStart):
    conn = get_conn()
    running = conn.execute("SELECT id FROM entries WHERE end_time IS NULL").fetchone()
    if running:
        conn.close()
        raise HTTPException(400, "A timer is already running")

    title = payload.title.strip() or "Untitled"
    cur = conn.execute(
        "INSERT INTO entries (title, start_time, end_time, project_id) VALUES (?, ?, NULL, ?)",
        (title, now_iso(), payload.project_id),
    )
    entry_id = cur.lastrowid
    for tag_name in payload.tags:
        tag_id = get_or_create_tag(conn, tag_name)
        conn.execute(
            "INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)",
            (entry_id, tag_id),
        )
    conn.commit()
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    result = serialize_entry(conn, row)
    conn.close()
    return result


@router.post("/stop")
def stop_timer():
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM entries WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1"
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(400, "No timer is running")
    conn.execute(
        "UPDATE entries SET end_time = ? WHERE id = ?", (now_iso(), row["id"])
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM entries WHERE id = ?", (row["id"],)).fetchone()
    result = serialize_entry(conn, updated)
    conn.close()
    return result
