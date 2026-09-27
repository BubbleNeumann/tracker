import mimetypes
import os
import secrets

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

import auth
from db import init_db
from routers import entries, projects, stats, tags, timer

# Windows registries sometimes report .js as text/plain, which browsers
# refuse to load as an ES module.
mimetypes.add_type("application/javascript", ".js")

app = FastAPI(title="Tracker")

init_db()

AUTH_USER = os.environ.get("TRACKER_USER")
AUTH_PASSWORD = os.environ.get("TRACKER_PASSWORD")

if not AUTH_USER or not AUTH_PASSWORD:
    print(
        "WARNING: TRACKER_USER / TRACKER_PASSWORD not set - the app is running "
        "without a login. Set both environment variables to require one."
    )

LOGIN_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/png" href="/static/img/cookie-icon.png">
<title>Tracker - Login</title>
<style>
  :root {{ --bg: #121212; --card-bg: #262626; --border: #444; --text: #f5f5f5; --green: #7cff2e; --red: #ff2e6d; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }}
  .card {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 24px; width: 100%; max-width: 320px; }}
  h1 {{ font-size: 18px; margin: 0 0 18px; }}
  input {{ width: 100%; background: #161616; border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; color: var(--text); font-size: 14px; margin-bottom: 12px; }}
  button {{ width: 100%; border: none; border-radius: 6px; padding: 10px; font-size: 14px; font-weight: 600; cursor: pointer; background: var(--green); color: #0a1a02; }}
  .error {{ color: var(--red); font-size: 13px; margin-bottom: 12px; }}
</style>
</head>
<body>
  <form class="card" method="post" action="/login">
    <h1>Tracker Login</h1>
    {error_html}
    <input type="text" name="username" placeholder="Username" autofocus required />
    <input type="password" name="password" placeholder="Password" required />
    <button type="submit">Log in</button>
  </form>
</body>
</html>
"""


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _fingerprint(request: Request) -> str:
    return auth.compute_fingerprint(
        request.headers.get("user-agent", ""),
        request.headers.get("accept-language", ""),
    )


def _banned_response() -> Response:
    # Deliberately minimal: no template rendering, no DB lookups beyond the
    # ban check itself, so a banned IP can't cost us much even under a flood.
    return Response(status_code=403, content="Forbidden")


@app.middleware("http")
async def enforce_login(request: Request, call_next):
    if not AUTH_USER or not AUTH_PASSWORD:
        return await call_next(request)

    ip = _client_ip(request)
    if auth.is_banned(ip, _fingerprint(request)):
        return _banned_response()

    if request.url.path == "/login":
        return await call_next(request)

    token = request.cookies.get(auth.COOKIE_NAME)
    username = auth.verify_session_token(token) if token else None
    if not username:
        return RedirectResponse(url="/login", status_code=302)

    return await call_next(request)


@app.get("/login", response_class=HTMLResponse)
def login_form():
    return LOGIN_PAGE.format(error_html="")


@app.post("/login")
async def login_submit(request: Request):
    ip = _client_ip(request)
    fingerprint = _fingerprint(request)
    if auth.is_banned(ip, fingerprint):
        return _banned_response()

    form = await request.form()
    username = form.get("username", "")
    password = form.get("password", "")

    valid = secrets.compare_digest(username, AUTH_USER) and secrets.compare_digest(
        password, AUTH_PASSWORD
    )

    if not valid:
        just_banned = auth.record_failed_attempt(ip, fingerprint)
        if just_banned:
            return _banned_response()
        return HTMLResponse(
            LOGIN_PAGE.format(error_html='<div class="error">Invalid username or password.</div>'),
            status_code=401,
        )

    auth.reset_attempts(ip)
    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(
        auth.COOKIE_NAME,
        auth.make_session_token(username),
        max_age=auth.SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return response


app.include_router(projects.router)
app.include_router(tags.router)
app.include_router(entries.router)
app.include_router(timer.router)
app.include_router(stats.router)

class NoCacheStaticFiles(StaticFiles):
    """Forces browsers to always revalidate (via ETag/Last-Modified) instead
    of serving a stale cached copy of JS/CSS after a deploy."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


app.mount("/static", NoCacheStaticFiles(directory="static"), name="static")


@app.get("/")
def index():
    response = FileResponse("static/index.html")
    response.headers["Cache-Control"] = "no-cache"
    return response
