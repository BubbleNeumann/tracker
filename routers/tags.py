from fastapi import APIRouter, HTTPException

from db import get_conn
from helpers import get_or_create_tag
from models import TagCreate

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
def list_tags():
    conn = get_conn()
    rows = conn.execute("SELECT id, name FROM tags ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("")
def create_tag(payload: TagCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Tag name required")
    conn = get_conn()
    tag_id = get_or_create_tag(conn, name)
    conn.commit()
    row = conn.execute("SELECT id, name FROM tags WHERE id = ?", (tag_id,)).fetchone()
    conn.close()
    return dict(row)


@router.delete("/{tag_id}")
def delete_tag(tag_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
