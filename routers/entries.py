from fastapi import APIRouter, HTTPException

from db import get_conn
from helpers import get_or_create_tag, serialize_entry
from models import EntryCreate, EntryUpdate

router = APIRouter(prefix="/api/entries", tags=["entries"])


@router.get("")
def list_entries(project_id: int | None = None):
    conn = get_conn()
    if project_id is not None:
        rows = conn.execute(
            "SELECT * FROM entries WHERE end_time IS NOT NULL AND project_id = ? ORDER BY start_time DESC",
            (project_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM entries WHERE end_time IS NOT NULL ORDER BY start_time DESC"
        ).fetchall()
    result = [serialize_entry(conn, r) for r in rows]
    conn.close()
    return result


@router.post("")
def create_entry(payload: EntryCreate):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO entries (title, start_time, end_time, project_id) VALUES (?, ?, ?, ?)",
        (payload.title.strip() or "Untitled", payload.start_time, payload.end_time, payload.project_id),
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


@router.put("/{entry_id}")
def update_entry(entry_id: int, payload: EntryUpdate):
    conn = get_conn()
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Entry not found")

    title = payload.title if payload.title is not None else row["title"]
    start_time = payload.start_time if payload.start_time is not None else row["start_time"]
    end_time = payload.end_time if payload.end_time is not None else row["end_time"]
    project_id = payload.project_id if payload.project_id is not None else row["project_id"]
    conn.execute(
        "UPDATE entries SET title = ?, start_time = ?, end_time = ?, project_id = ? WHERE id = ?",
        (title, start_time, end_time, project_id, entry_id),
    )

    if payload.tags is not None:
        conn.execute("DELETE FROM entry_tags WHERE entry_id = ?", (entry_id,))
        for tag_name in payload.tags:
            tag_id = get_or_create_tag(conn, tag_name)
            conn.execute(
                "INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)",
                (entry_id, tag_id),
            )

    conn.commit()
    updated = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    result = serialize_entry(conn, updated)
    conn.close()
    return result


@router.delete("/{entry_id}")
def delete_entry(entry_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
