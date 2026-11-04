from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def entry_duration_seconds(entry_row) -> float:
    """Tracked time of an entry: its start-to-end span minus time spent paused.
    A running entry is measured up to now, or up to the moment it was paused."""
    start = datetime.fromisoformat(entry_row["start_time"])
    end_iso = entry_row["end_time"] or entry_row["paused_at"] or now_iso()
    end = datetime.fromisoformat(end_iso)
    return max(0.0, (end - start).total_seconds() - (entry_row["paused_seconds"] or 0))


def get_or_create_tag(conn, name: str, project_id: int) -> int:
    name = name.strip()
    row = conn.execute(
        "SELECT id FROM tags WHERE name = ? AND project_id = ?", (name, project_id)
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        "INSERT INTO tags (name, project_id) VALUES (?, ?)", (name, project_id)
    )
    return cur.lastrowid


def serialize_entry(conn, entry_row) -> dict:
    tags = conn.execute(
        """
        SELECT t.name FROM tags t
        JOIN entry_tags et ON et.tag_id = t.id
        WHERE et.entry_id = ?
        ORDER BY t.name
        """,
        (entry_row["id"],),
    ).fetchall()
    return {
        "id": entry_row["id"],
        "title": entry_row["title"],
        "start_time": entry_row["start_time"],
        "end_time": entry_row["end_time"],
        "project_id": entry_row["project_id"],
        "paused_at": entry_row["paused_at"],
        "paused_seconds": entry_row["paused_seconds"] or 0,
        "tags": [t["name"] for t in tags],
    }
