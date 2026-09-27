# tracker

A minimal self-hosted time tracker. FastAPI backend, SQLite storage, no build step on the frontend.

## Features

- Start/stop timer with a live-updating running widget
- Multiple projects, each with its own color
- Tags on time entries (create, assign, delete)
- Entries grouped by day
- Statistics tab: total hours, a daily activity chart, and a GitHub-style calendar heatmap, all filterable by project

## Running locally

```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Project structure

```
main.py            FastAPI app setup, mounts routers and static files
db.py               SQLite connection + schema/migrations
models.py           Pydantic request models
helpers.py          Shared DB helpers
routers/            One router per resource (projects, tags, entries, timer, stats)
static/
  index.html
  style.css
  js/               ES modules (api, state, tags, projects, timer, entries, stats, tabs, main)
```
