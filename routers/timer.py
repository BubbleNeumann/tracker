from datetime import datetime

from fastapi import APIRouter, HTTPException

from db import get_conn
from helpers import get_or_create_tag, now_iso, serialize_entry
from models import TimerStart

router = APIRouter(prefix="/api/timer", tags=["timer"])


@router.get("/current")
def current_timer(project_id: int):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM entries WHERE end_time IS NULL AND project_id = ? ORDER BY start_time DESC LIMIT 1",
        (project_id,),
    ).fetchone()
    result = serialize_entry(conn, row) if row else None
    conn.close()
    return result


@router.get("/running")
def running_timers():
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM entries WHERE end_time IS NULL ORDER BY start_time DESC"
    ).fetchall()
    result = [serialize_entry(conn, r) for r in rows]
    conn.close()
    return result


@router.post("/start")
def start_timer(payload: TimerStart):
    conn = get_conn()
    running = conn.execute(
        "SELECT id FROM entries WHERE end_time IS NULL AND project_id = ?",
        (payload.project_id,),
    ).fetchone()
    if running:
        conn.close()
        raise HTTPException(400, "A timer is already running for this project")

    title = payload.title.strip() or "Untitled"
    cur = conn.execute(
        "INSERT INTO entries (title, start_time, end_time, project_id) VALUES (?, ?, NULL, ?)",
        (title, now_iso(), payload.project_id),
    )
    entry_id = cur.lastrowid
    for tag_name in payload.tags:
        tag_id = get_or_create_tag(conn, tag_name, payload.project_id)
        conn.execute(
            "INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)",
            (entry_id, tag_id),
        )
    conn.commit()
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    result = serialize_entry(conn, row)
    conn.close()
    return result


def _running_entry(conn, project_id: int):
    row = conn.execute(
        "SELECT * FROM entries WHERE end_time IS NULL AND project_id = ? ORDER BY start_time DESC LIMIT 1",
        (project_id,),
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(400, "No timer is running for this project")
    return row


def _finish(conn, entry_id: int):
    conn.commit()
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    result = serialize_entry(conn, row)
    conn.close()
    return result


@router.post("/pause")
def pause_timer(project_id: int):
    conn = get_conn()
    row = _running_entry(conn, project_id)
    if row["paused_at"]:
        conn.close()
        raise HTTPException(400, "Timer is already paused")
    conn.execute("UPDATE entries SET paused_at = ? WHERE id = ?", (now_iso(), row["id"]))
    return _finish(conn, row["id"])


@router.post("/resume")
def resume_timer(project_id: int):
    conn = get_conn()
    row = _running_entry(conn, project_id)
    if not row["paused_at"]:
        conn.close()
        raise HTTPException(400, "Timer is not paused")
    paused_for = (
        datetime.fromisoformat(now_iso()) - datetime.fromisoformat(row["paused_at"])
    ).total_seconds()
    conn.execute(
        "UPDATE entries SET paused_at = NULL, paused_seconds = paused_seconds + ? WHERE id = ?",
        (max(0.0, paused_for), row["id"]),
    )
    return _finish(conn, row["id"])


@router.post("/stop")
def stop_timer(project_id: int):
    conn = get_conn()
    row = _running_entry(conn, project_id)
    # Stopping while paused ends the entry at the moment it was paused, so the
    # trailing pause is not counted as part of the activity.
    end_time = row["paused_at"] or now_iso()
    conn.execute(
        "UPDATE entries SET end_time = ?, paused_at = NULL WHERE id = ?",
        (end_time, row["id"]),
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM entries WHERE id = ?", (row["id"],)).fetchone()
    result = serialize_entry(conn, updated)
    conn.close()
    return result
