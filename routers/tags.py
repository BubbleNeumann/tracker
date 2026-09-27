from fastapi import APIRouter, HTTPException

from db import get_conn
from helpers import get_or_create_tag
from models import TagCreate, TagUpdate

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
def list_tags(project_id: int):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, name FROM tags WHERE project_id = ? ORDER BY name", (project_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("")
def create_tag(payload: TagCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Tag name required")
    conn = get_conn()
    tag_id = get_or_create_tag(conn, name, payload.project_id)
    conn.commit()
    row = conn.execute("SELECT id, name FROM tags WHERE id = ?", (tag_id,)).fetchone()
    conn.close()
    return dict(row)


@router.put("/{tag_id}")
def rename_tag(tag_id: int, payload: TagUpdate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Tag name required")
    conn = get_conn()
    row = conn.execute("SELECT * FROM tags WHERE id = ?", (tag_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Tag not found")
    try:
        conn.execute("UPDATE tags SET name = ? WHERE id = ?", (name, tag_id))
    except Exception:
        conn.close()
        raise HTTPException(400, "A tag with that name already exists in this project")
    conn.commit()
    updated = conn.execute("SELECT id, name FROM tags WHERE id = ?", (tag_id,)).fetchone()
    conn.close()
    return dict(updated)


@router.delete("/{tag_id}")
def delete_tag(tag_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
