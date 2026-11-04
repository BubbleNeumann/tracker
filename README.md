# tracker

A minimal self-hosted time tracker. FastAPI backend, SQLite storage, no build step on the frontend.

## Features

- Start/stop timer with a live-updating running widget
- Pause and resume a running timer; paused time is left out of the entry's duration and all stats,
  and the activity stays a single entry
- One running timer per project, with several projects able to run at once (shown as cards in the corner)
- Play button on any past entry to continue it: starts a new timer with the same title and tags
- Multiple projects, each with its own color
- Tags on time entries (create, rename, recolor, delete, assign)
- Inline entry editing (title, start/end time, project, tags), delete with confirmation, and a day-grouped entry list
- Statistics tab: total hours, a daily activity chart, and a GitHub-style calendar heatmap, all filterable by project
- Optional login screen with failed-attempt banning

## Running locally

```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

The SQLite database lives at `data/tracker.db` and is created on first start. Schema migrations run
automatically at startup, so restart the server after pulling changes.

## Configuration

All configuration is via environment variables:

| Variable | Purpose |
|---|---|
| `TRACKER_USER`, `TRACKER_PASSWORD` | Enable the login screen. If either is unset, the app runs with no auth. |
| `TRACKER_SECRET_KEY` | Signing key for session cookies. If unset, a key is generated and persisted to `data/secret.key`. |

## Deployment

`.github/workflows/deploy.yml` deploys the app on every push to `master`. See that file for the target/steps.

## Project structure

```
main.py             FastAPI app setup, login/auth middleware, mounts routers and static files
auth.py             Session tokens, password check, failed-login banning
db.py               SQLite connection + schema/migrations
models.py           Pydantic request models
helpers.py          Shared DB helpers (incl. entry duration that excludes paused time)
CLAUDE.md           Notes for AI-assisted development (data model, conventions, gotchas)
routers/            One router per resource (projects, tags, entries, timer, stats)
static/
  index.html
  style.css
  img/              Static image assets (see Credits)
  js/               ES modules (api, state, tags, tagPicker, projects, timer, entries,
                     editEntry, stats, tabs, format, icons, main)
```
