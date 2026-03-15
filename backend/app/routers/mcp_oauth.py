"""
MCP OAuth 2.0 Authorization Server
Flow: Claude opens popup → /oauth/authorize → Plex OAuth → callback → code → /oauth/token → API key
"""
import secrets
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
import httpx
from sqlalchemy import select

from ..database import async_session
from ..models import ApiKey, User

router = APIRouter(tags=["mcp-oauth"])

# Temporary storage for auth flows (in production use Redis)
_pending_flows: dict[str, dict] = {}  # state → {plex_pin_id, code_challenge, redirect_uri, client_id}
_auth_codes: dict[str, dict] = {}     # code → {user_id, expires}

PLEX_HEADERS = {
    "X-Plex-Product": "Watchlist MCP",
    "X-Plex-Version": "1.0",
    "X-Plex-Client-Identifier": "watchlist-mcp-oauth",
    "Accept": "application/json",
}


# ─── OAuth Metadata ───────────────────────────────────────────────


@router.get("/.well-known/oauth-authorization-server")
async def oauth_metadata(request: Request):
    base = str(request.base_url).rstrip("/")
    return JSONResponse(content={
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
    })


# ─── Dynamic Client Registration (MCP spec requires this) ─────────


@router.post("/oauth/register")
async def oauth_register(request: Request):
    body = await request.json()
    client_id = secrets.token_hex(16)
    return JSONResponse(content={
        "client_id": client_id,
        "client_name": body.get("client_name", "MCP Client"),
        "redirect_uris": body.get("redirect_uris", []),
    }, status_code=201)


# ─── Authorization Endpoint ───────────────────────────────────────


@router.get("/oauth/authorize")
async def oauth_authorize(
    client_id: str,
    redirect_uri: str,
    state: str,
    response_type: str = "code",
    code_challenge: str = "",
    code_challenge_method: str = "S256",
    scope: str = "",
):
    """Start OAuth flow — create Plex PIN and redirect to Plex auth."""
    # Create Plex PIN
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://plex.tv/api/v2/pins",
            headers=PLEX_HEADERS,
            data={"strong": "true"},
            timeout=10,
        )
        resp.raise_for_status()
        pin_data = resp.json()

    plex_pin_id = pin_data["id"]
    plex_code = pin_data["code"]

    # Store flow state
    _pending_flows[state] = {
        "plex_pin_id": plex_pin_id,
        "code_challenge": code_challenge,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "created": time.time(),
    }

    # Return HTML page that opens Plex auth and polls for completion
    plex_auth_url = f"https://app.plex.tv/auth#!?clientID=watchlist-mcp-oauth&code={plex_code}&context%5Bdevice%5D%5Bproduct%5D=Watchlist%20MCP"

    html = f"""<!DOCTYPE html>
<html><head><title>Watchlist - Plex Login</title>
<style>
body {{ background: #12122e; color: white; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
.card {{ background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; text-align: center; max-width: 400px; }}
.spinner {{ width: 40px; height: 40px; border: 3px solid rgba(229,160,13,0.2); border-top-color: #e5a00d; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }}
@keyframes spin {{ to {{ transform: rotate(360deg); }} }}
a {{ color: #e5a00d; text-decoration: none; font-weight: bold; }}
.status {{ color: rgba(255,255,255,0.5); font-size: 14px; }}
</style></head>
<body><div class="card">
<h2>Mit Plex anmelden</h2>
<p class="status" id="status">Öffne Plex Login...</p>
<div class="spinner" id="spinner"></div>
<p><a href="{plex_auth_url}" target="_blank" id="plex-link">Plex Login öffnen</a></p>
<script>
window.open("{plex_auth_url}", "plex_auth", "width=800,height=600");
let attempts = 0;
const poll = setInterval(async () => {{
  attempts++;
  if (attempts > 120) {{ clearInterval(poll); document.getElementById("status").textContent = "Zeitüberschreitung"; return; }}
  try {{
    const resp = await fetch("/oauth/callback?state={state}");
    const data = await resp.json();
    if (data.redirect) {{
      clearInterval(poll);
      document.getElementById("status").textContent = "Erfolgreich! Weiterleitung...";
      document.getElementById("spinner").style.display = "none";
      window.location.href = data.redirect;
    }}
  }} catch(e) {{}}
}}, 2000);
</script>
</div></body></html>"""

    return HTMLResponse(content=html)


# ─── OAuth Callback (polled by authorize page) ────────────────────


@router.get("/oauth/callback")
async def oauth_callback(state: str):
    """Check if Plex auth is complete and return redirect with code."""
    flow = _pending_flows.get(state)
    if not flow:
        raise HTTPException(status_code=400, detail="Invalid state")

    # Check if flow is too old (10 min)
    if time.time() - flow["created"] > 600:
        _pending_flows.pop(state, None)
        raise HTTPException(status_code=400, detail="Flow expired")

    # Check Plex PIN
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://plex.tv/api/v2/pins/{flow['plex_pin_id']}",
            headers=PLEX_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        pin_data = resp.json()

    auth_token = pin_data.get("authToken")
    if not auth_token:
        return JSONResponse(content={"status": "waiting"})

    # Get Plex user info
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://plex.tv/api/v2/user",
            headers={**PLEX_HEADERS, "X-Plex-Token": auth_token},
            timeout=10,
        )
        resp.raise_for_status()
        plex_user = resp.json()

    plex_id = str(plex_user.get("id", ""))
    plex_username = plex_user.get("username") or plex_user.get("title", "")
    plex_email = plex_user.get("email", "")

    # Find or create user
    async with async_session() as db:
        result = await db.execute(select(User).where(User.plex_id == plex_id))
        user = result.scalar_one_or_none()

        if not user:
            # Auto-register
            from ..models import Watchlist
            username = plex_username
            result = await db.execute(select(User).where(User.username == username))
            if result.scalar_one_or_none():
                username = f"{plex_username}_{plex_id[:4]}"
            email = plex_email or f"plex_{plex_id}@plex.local"
            result = await db.execute(select(User).where(User.email == email))
            if result.scalar_one_or_none():
                email = f"plex_{plex_id}@plex.local"

            user = User(username=username, email=email, auth_provider="plex", plex_id=plex_id, plex_username=plex_username, plex_token=auth_token)
            db.add(user)
            await db.flush()
            db.add(Watchlist(owner_id=user.id, name="Meine Watchlist", icon="🎬", is_default=True))

        user.plex_token = auth_token
        user.plex_username = plex_username
        await db.commit()
        user_id = user.id

    # Generate authorization code
    code = secrets.token_hex(32)
    _auth_codes[code] = {"user_id": user_id, "expires": time.time() + 300}  # 5 min

    # Clean up flow
    _pending_flows.pop(state, None)

    # Build redirect URL with code
    redirect_uri = flow["redirect_uri"]
    separator = "&" if "?" in redirect_uri else "?"
    redirect_url = f"{redirect_uri}{separator}code={code}&state={state}"

    return JSONResponse(content={"redirect": redirect_url})


# ─── Token Endpoint ───────────────────────────────────────────────


@router.post("/oauth/token")
async def oauth_token(request: Request):
    """Exchange authorization code for API key (access_token)."""
    body = await request.form()
    grant_type = body.get("grant_type")
    code = body.get("code")

    if grant_type != "authorization_code":
        raise HTTPException(status_code=400, detail="Unsupported grant_type")

    if not code or code not in _auth_codes:
        raise HTTPException(status_code=400, detail="Invalid code")

    auth = _auth_codes.pop(code)
    if time.time() > auth["expires"]:
        raise HTTPException(status_code=400, detail="Code expired")

    # Create API key for the user
    async with async_session() as db:
        key = secrets.token_hex(32)
        api_key = ApiKey(user_id=auth["user_id"], name="MCP OAuth", key=key)
        db.add(api_key)
        await db.commit()

    return JSONResponse(content={
        "access_token": key,
        "token_type": "Bearer",
        "scope": "watchlist",
    })
