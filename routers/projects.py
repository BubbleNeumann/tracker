from fastapi import APIRouter, HTTPException

from db import get_conn
from models import ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects():
    conn = get_conn()
    rows = conn.execute("SELECT id, name, color FROM projects ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("")
def create_project(payload: ProjectCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Project name required")
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO projects (name, color) VALUES (?, ?)", (name, payload.color)
        )
    except Exception:
        conn.close()
        raise HTTPException(400, "A project with that name already exists")
    conn.commit()
    row = conn.execute(
        "SELECT id, name, color FROM projects WHERE id = ?", (cur.lastrowid,)
    ).fetchone()
    conn.close()
    return dict(row)


@router.put("/{project_id}")
def update_project(project_id: int, payload: ProjectUpdate):
    conn = get_conn()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Project not found")

    name = payload.name.strip() if payload.name is not None else row["name"]
    color = payload.color if payload.color is not None else row["color"]
    if not name:
        conn.close()
        raise HTTPException(400, "Project name required")

    try:
        conn.execute(
            "UPDATE projects SET name = ?, color = ? WHERE id = ?", (name, color, project_id)
        )
    except Exception:
        conn.close()
        raise HTTPException(400, "A project with that name already exists")
    conn.commit()
    updated = conn.execute(
        "SELECT id, name, color FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    conn.close()
    return dict(updated)


@router.delete("/{project_id}")
def delete_project(project_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
