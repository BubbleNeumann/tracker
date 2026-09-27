from datetime import datetime

from fastapi import APIRouter

from db import get_conn

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _entries_for(project_id: str):
    conn = get_conn()
    if project_id == "all":
        rows = conn.execute(
            "SELECT id, title, start_time, end_time FROM entries WHERE end_time IS NOT NULL"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, title, start_time, end_time FROM entries WHERE end_time IS NOT NULL AND project_id = ?",
            (int(project_id),),
        ).fetchall()
    conn.close()
    return rows


@router.get("")
def stats(project_id: str = "all"):
    rows = _entries_for(project_id)
    total_seconds = 0.0
    longest_seconds = 0.0
    longest_entry_id = None
    for r in rows:
        start = datetime.fromisoformat(r["start_time"])
        end = datetime.fromisoformat(r["end_time"])
        duration = (end - start).total_seconds()
        total_seconds += duration
        if duration > longest_seconds:
            longest_seconds = duration
            longest_entry_id = r["id"]

    longest_label = None
    if longest_entry_id is not None:
        conn = get_conn()
        tag_row = conn.execute(
            """
            SELECT t.name FROM tags t
            JOIN entry_tags et ON et.tag_id = t.id
            WHERE et.entry_id = ?
            ORDER BY t.name LIMIT 1
            """,
            (longest_entry_id,),
        ).fetchone()
        entry_row = conn.execute(
            "SELECT title FROM entries WHERE id = ?", (longest_entry_id,)
        ).fetchone()
        conn.close()
        if tag_row:
            longest_label = tag_row["name"]
        elif entry_row:
            longest_label = entry_row["title"]

    return {
        "total_seconds": total_seconds,
        "total_hours": round(total_seconds / 3600, 2),
        "sessions": len(rows),
        "longest_seconds": longest_seconds,
        "longest_label": longest_label,
    }


@router.get("/daily")
def stats_daily(project_id: str = "all"):
    rows = _entries_for(project_id)
    daily: dict[str, float] = {}
    for r in rows:
        start = datetime.fromisoformat(r["start_time"])
        end = datetime.fromisoformat(r["end_time"])
        key = start.date().isoformat()
        daily[key] = daily.get(key, 0.0) + (end - start).total_seconds()
    return [{"date": d, "seconds": s} for d, s in sorted(daily.items())]


@router.get("/by-tag")
def stats_by_tag(project_id: str = "all"):
    conn = get_conn()
    where = "e.end_time IS NOT NULL"
    params: list = []
    if project_id != "all":
        where += " AND e.project_id = ?"
        params.append(int(project_id))
    rows = conn.execute(
        f"""
        SELECT t.name AS tag, p.id AS project_id, p.name AS project_name, p.color AS project_color,
               e.start_time, e.end_time
        FROM entries e
        JOIN entry_tags et ON et.entry_id = e.id
        JOIN tags t ON t.id = et.tag_id
        JOIN projects p ON p.id = e.project_id
        WHERE {where}
        """,
        params,
    ).fetchall()
    conn.close()

    totals: dict[tuple, dict] = {}
    for r in rows:
        start = datetime.fromisoformat(r["start_time"])
        end = datetime.fromisoformat(r["end_time"])
        key = (r["project_id"], r["tag"])
        if key not in totals:
            totals[key] = {
                "tag": r["tag"],
                "project_id": r["project_id"],
                "project_name": r["project_name"],
                "project_color": r["project_color"],
                "seconds": 0.0,
            }
        totals[key]["seconds"] += (end - start).total_seconds()

    result = list(totals.values())
    result.sort(key=lambda x: -x["seconds"])
    return result
