import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "tracker.db"

DEFAULT_PROJECT_COLOR = "#7cff2e"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


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
            name TEXT NOT NULL UNIQUE
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
            banned INTEGER NOT NULL DEFAULT 0
        );
        """
    )

    # migration for pre-existing databases created before "projects" existed
    entry_cols = [r["name"] for r in conn.execute("PRAGMA table_info(entries)").fetchall()]
    if "project_id" not in entry_cols:
        conn.execute(
            "ALTER TABLE entries ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE"
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
    conn.close()
