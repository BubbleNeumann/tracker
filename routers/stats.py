from datetime import datetime

from fastapi import APIRouter

from db import get_conn

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _entries_for(project_id: str):
    conn = get_conn()
    if project_id == "all":
        rows = conn.execute(
            "SELECT start_time, end_time FROM entries WHERE end_time IS NOT NULL"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT start_time, end_time FROM entries WHERE end_time IS NOT NULL AND project_id = ?",
            (int(project_id),),
        ).fetchall()
    conn.close()
    return rows


@router.get("")
def stats(project_id: str = "all"):
    rows = _entries_for(project_id)
    total_seconds = 0.0
    for r in rows:
        start = datetime.fromisoformat(r["start_time"])
        end = datetime.fromisoformat(r["end_time"])
        total_seconds += (end - start).total_seconds()
    return {"total_seconds": total_seconds, "total_hours": round(total_seconds / 3600, 2)}


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
