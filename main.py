import mimetypes

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from db import init_db
from routers import entries, projects, stats, tags, timer

# Windows registries sometimes report .js as text/plain, which browsers
# refuse to load as an ES module.
mimetypes.add_type("application/javascript", ".js")

app = FastAPI(title="Tracker")

init_db()

app.include_router(projects.router)
app.include_router(tags.router)
app.include_router(entries.router)
app.include_router(timer.router)
app.include_router(stats.router)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def index():
    return FileResponse("static/index.html")
