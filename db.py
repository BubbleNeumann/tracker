import shutil
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "tracker.db"

DEFAULT_PROJECT_COLOR = "#7cff2e"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _rebuild_entry_tags(conn):
    """Recreate entry_tags with its foreign key correctly pointing at the
    current `tags` table, preserving every existing row."""
    conn.execute("ALTER TABLE entry_tags RENAME TO entry_tags_old")
    conn.execute(
        """
        CREATE TABLE entry_tags (
            entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (entry_id, tag_id)
        )
        """
    )
    conn.execute(
        "INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) "
        "SELECT entry_id, tag_id FROM entry_tags_old"
    )
    conn.execute("DROP TABLE entry_tags_old")


def _repair_entry_tags_fk_if_broken(conn):
    """SQLite rewrites foreign keys in OTHER tables when a referenced table
    is renamed. The tags-per-project migration below renames `tags` to
    `tags_old` mid-flight, which silently repoints entry_tags.tag_id at
    "tags_old" - a table that gets dropped moments later. Detect and fix
    that dangling reference for databases that already migrated before this
    was caught."""
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='entry_tags'"
    ).fetchone()
    if row and "tags_old" in row["sql"]:
        _rebuild_entry_tags(conn)


def _migrate_tags_to_per_project(conn):
    """Pre-existing databases had a single global `tags` table (unique by
    name only). Split each old tag into one copy per project that actually
    uses it, so tags become unique per project while every existing
    entry keeps the exact tag it already had."""
    tag_cols = [r["name"] for r in conn.execute("PRAGMA table_info(tags)").fetchall()]
    if "project_id" in tag_cols:
        return  # already on the new schema

    old_tags = conn.execute("SELECT id, name FROM tags").fetchall()

    conn.execute("ALTER TABLE tags RENAME TO tags_old")
    conn.execute(
        """
        CREATE TABLE tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            UNIQUE(project_id, name)
        )
        """
    )

    default_project = conn.execute("SELECT id FROM projects ORDER BY id LIMIT 1").fetchone()
    default_project_id = default_project["id"] if default_project else None

    for old_tag in old_tags:
        project_rows = conn.execute(
            """
            SELECT DISTINCT e.project_id AS project_id
            FROM entry_tags et
            JOIN entries e ON e.id = et.entry_id
            WHERE et.tag_id = ? AND e.project_id IS NOT NULL
            """,
            (old_tag["id"],),
        ).fetchall()
        project_ids = [r["project_id"] for r in project_rows]

        if not project_ids:
            if default_project_id is None:
                continue
            project_ids = [default_project_id]

        first_project_id, *rest_project_ids = project_ids

        # Reuse the original tag id for its first project so nothing else
        # needs remapping for that project's entries.
        conn.execute(
            "INSERT INTO tags (id, project_id, name) VALUES (?, ?, ?)",
            (old_tag["id"], first_project_id, old_tag["name"]),
        )

        # Any other project that used this same tag name gets its own copy,
        # and the affected entry_tags rows are repointed to it.
        for project_id in rest_project_ids:
            cur = conn.execute(
                "INSERT INTO tags (project_id, name) VALUES (?, ?)",
                (project_id, old_tag["name"]),
            )
            new_tag_id = cur.lastrowid
            conn.execute(
                """
                UPDATE entry_tags
                SET tag_id = ?
                WHERE tag_id = ? AND entry_id IN (
                    SELECT id FROM entries WHERE project_id = ?
                )
                """,
                (new_tag_id, old_tag["id"], project_id),
            )

    conn.execute("DROP TABLE tags_old")

    # Renaming `tags` above silently repointed entry_tags.tag_id at the now
    # -dropped `tags_old`; rebuild it so it references the new `tags` table.
    _rebuild_entry_tags(conn)


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#7cff2e'
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            UNIQUE(project_id, name)
        );

        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS entry_tags (
            entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (entry_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_entries_project_start
            ON entries(project_id, start_time);

        CREATE TABLE IF NOT EXISTS login_security (
            ip TEXT PRIMARY KEY,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            banned INTEGER NOT NULL DEFAULT 0,
            banned_at TEXT,
            device_fingerprint TEXT
        );
        """
    )

    # migration for pre-existing databases created before "projects" existed
    entry_cols = [r["name"] for r in conn.execute("PRAGMA table_info(entries)").fetchall()]
    if "project_id" not in entry_cols:
        conn.execute(
            "ALTER TABLE entries ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE"
        )

    # migration for pre-existing databases created before ban tracking had
    # a timestamp / device fingerprint
    login_security_cols = [
        r["name"] for r in conn.execute("PRAGMA table_info(login_security)").fetchall()
    ]
    if "banned_at" not in login_security_cols:
        conn.execute("ALTER TABLE login_security ADD COLUMN banned_at TEXT")
    if "device_fingerprint" not in login_security_cols:
        conn.execute("ALTER TABLE login_security ADD COLUMN device_fingerprint TEXT")

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_login_security_fingerprint "
        "ON login_security(device_fingerprint)"
    )

    if conn.execute("SELECT COUNT(*) AS c FROM projects").fetchone()["c"] == 0:
        conn.execute(
            "INSERT INTO projects (name, color) VALUES (?, ?)",
            ("My Project", DEFAULT_PROJECT_COLOR),
        )
        default_id = conn.execute("SELECT id FROM projects LIMIT 1").fetchone()["id"]
        conn.execute(
            "UPDATE entries SET project_id = ? WHERE project_id IS NULL", (default_id,)
        )

    conn.commit()

    # The migrations below rename/recreate tables across several statements
    # that are not guaranteed to be atomic (SQLite's Python driver has
    # historically auto-committed pending DDL). Back up the file first so a
    # crash or error mid-migration can be rolled back to a known-good state
    # instead of leaving stray *_old tables behind.
    backup_path = DB_PATH.with_suffix(".db.bak")
    conn.close()
    shutil.copy2(DB_PATH, backup_path)
    conn = get_conn()
    try:
        _migrate_tags_to_per_project(conn)
        _repair_entry_tags_fk_if_broken(conn)
        conn.commit()
        conn.close()
    except Exception:
        conn.close()
        shutil.copy2(backup_path, DB_PATH)
        raise
    finally:
        backup_path.unlink(missing_ok=True)
