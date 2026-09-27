from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def get_or_create_tag(conn, name: str) -> int:
    name = name.strip()
    row = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
    if row:
        return row["id"]
    cur = conn.execute("INSERT INTO tags (name) VALUES (?)", (name,))
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
        "tags": [t["name"] for t in tags],
    }
