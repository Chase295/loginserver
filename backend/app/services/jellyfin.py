import logging

import httpx

logger = logging.getLogger(__name__)

TIMEOUT = 15
AUTH_HEADER = 'MediaBrowser Client="Watchlist", Device="Server", DeviceId="watchlist-app", Version="1.0"'


async def authenticate(url: str, username: str, password: str) -> dict:
    """Authenticate with Jellyfin and get access token + user ID."""
    headers = {"X-Emby-Authorization": AUTH_HEADER}
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.post(
            f"{url}/Users/AuthenticateByName",
            json={"Username": username, "Pw": password},
            headers=headers, timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "token": data.get("AccessToken"),
            "user_id": data.get("User", {}).get("Id"),
            "username": data.get("User", {}).get("Name"),
            "server_name": data.get("ServerId"),
        }


def _headers(token: str) -> dict:
    return {"X-Emby-Authorization": AUTH_HEADER, "X-Emby-Token": token}


async def _request(url: str, token: str, method: str, path: str, params: dict | None = None, json: dict | None = None) -> dict | list:
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.request(method, f"{url}{path}", headers=_headers(token), params=params, json=json, timeout=TIMEOUT)
        if resp.status_code == 401:
            # Try to refresh token
            new_token = await _try_refresh_token(url, token)
            if new_token:
                resp = await client.request(method, f"{url}{path}", headers=_headers(new_token), params=params, json=json, timeout=TIMEOUT)
        resp.raise_for_status()
        if resp.status_code == 204 or not resp.content:
            return {}
        try:
            return resp.json()
        except Exception:
            return {}


async def _try_refresh_token(url: str, old_token: str) -> str | None:
    """Try to re-authenticate using stored credentials."""
    try:
        from ..database import async_session
        from ..models import JellyfinServer
        from sqlalchemy import select
        async with async_session() as db:
            # Find by URL first (token might have changed), then by token as fallback
            srv = (await db.execute(select(JellyfinServer).where(JellyfinServer.url == url, JellyfinServer.jf_username != None))).scalars().first()
            if not srv or not srv.jf_username or not srv.jf_password:
                return None
            auth = await authenticate(srv.url, srv.jf_username, srv.jf_password)
            srv.token = auth["token"]
            await db.commit()
            logger.info(f"Jellyfin token refreshed for {srv.name}")
            return auth["token"]
    except Exception as e:
        logger.error(f"Jellyfin token refresh failed: {e}")
        return None


async def test_connection(url: str, token: str, user_id: str) -> dict:
    data = await _request(url, token, "GET", "/System/Info/Public")
    return {"status": "ok", "name": data.get("ServerName", "Jellyfin"), "version": data.get("Version", "?")}


async def get_libraries(url: str, token: str) -> list[dict]:
    data = await _request(url, token, "GET", "/Library/VirtualFolders")
    return [{"name": lib.get("Name"), "type": lib.get("CollectionType", ""), "id": lib.get("ItemId")} for lib in data]


# --- Find by TMDB ID ---


_jf_cache: dict[str, dict] = {}  # url -> {tmdb_id -> item, "expires": timestamp}


async def find_by_tmdb(url: str, token: str, user_id: str, tmdb_id: int, media_type: str) -> dict | None:
    """Find an item on Jellyfin by TMDB ID. Builds a cache of all items."""
    import time
    cache_key = f"{url}_{user_id}_{media_type}"
    cached = _jf_cache.get(cache_key)

    if not cached or cached.get("expires", 0) < time.time():
        # Build cache: fetch ALL items of this type with ProviderIds
        item_type = "Movie" if media_type == "movie" else "Series"
        data = await _request(url, token, "GET", f"/Users/{user_id}/Items", params={
            "Recursive": "true", "IncludeItemTypes": item_type,
            "Fields": "ProviderIds",
            "Limit": 10000,
        })
        mapping = {}
        for item in data.get("Items", []):
            tid = item.get("ProviderIds", {}).get("Tmdb")
            if tid:
                mapping[str(tid)] = {
                    "id": item.get("Id"),
                    "name": item.get("Name"),
                    "year": item.get("ProductionYear"),
                    "played": item.get("UserData", {}).get("Played", False),
                    "playCount": item.get("UserData", {}).get("PlayCount", 0),
                    "tmdbId": tid,
                }
        _jf_cache[cache_key] = {**mapping, "expires": time.time() + 300}
        cached = _jf_cache[cache_key]

    return cached.get(str(tmdb_id))


# --- Watch Status ---


async def mark_watched(url: str, token: str, user_id: str, item_id: str) -> None:
    await _request(url, token, "POST", f"/Users/{user_id}/PlayedItems/{item_id}")


async def mark_unwatched(url: str, token: str, user_id: str, item_id: str) -> None:
    await _request(url, token, "DELETE", f"/Users/{user_id}/PlayedItems/{item_id}")


# --- Episodes ---


async def get_seasons(url: str, token: str, user_id: str, series_id: str) -> list[dict]:
    data = await _request(url, token, "GET", f"/Shows/{series_id}/Seasons", params={"UserId": user_id})
    return data.get("Items", [])


async def get_episodes(url: str, token: str, user_id: str, series_id: str, season_id: str) -> list[dict]:
    data = await _request(url, token, "GET", f"/Shows/{series_id}/Episodes", params={
        "UserId": user_id, "SeasonId": season_id, "Fields": "ProviderIds,MediaSources",
    })
    return data.get("Items", [])


async def mark_episode_watched(url: str, token: str, user_id: str, episode_id: str) -> None:
    await _request(url, token, "POST", f"/Users/{user_id}/PlayedItems/{episode_id}")


async def mark_episode_unwatched(url: str, token: str, user_id: str, episode_id: str) -> None:
    await _request(url, token, "DELETE", f"/Users/{user_id}/PlayedItems/{episode_id}")


# --- Get all watched (for sync) ---


async def get_watched_movies(url: str, token: str, user_id: str) -> list[dict]:
    data = await _request(url, token, "GET", f"/Users/{user_id}/Items", params={
        "Recursive": "true", "IsPlayed": "true", "IncludeItemTypes": "Movie",
        "Fields": "ProviderIds", "Limit": 10000,
    })
    return [{"name": i.get("Name"), "year": i.get("ProductionYear"), "tmdb_id": int(i["ProviderIds"]["Tmdb"])}
            for i in data.get("Items", []) if i.get("ProviderIds", {}).get("Tmdb")]


async def get_watched_episodes(url: str, token: str, user_id: str) -> list[dict]:
    """Get all watched episodes grouped by series."""
    data = await _request(url, token, "GET", f"/Users/{user_id}/Items", params={
        "Recursive": "true", "IsPlayed": "true", "IncludeItemTypes": "Episode",
        "Fields": "ProviderIds,SeriesId", "Limit": 50000,
    })
    # Group by series
    series = {}
    for ep in data.get("Items", []):
        series_name = ep.get("SeriesName", "?")
        series_id = ep.get("SeriesId")
        season_num = ep.get("ParentIndexNumber", 0)
        ep_num = ep.get("IndexNumber", 0)
        if not series_id or season_num == 0:
            continue
        if series_id not in series:
            series[series_id] = {"name": series_name, "series_id": series_id, "episodes": {}}
        s_key = str(season_num)
        if s_key not in series[series_id]["episodes"]:
            series[series_id]["episodes"][s_key] = []
        series[series_id]["episodes"][s_key].append(ep_num)

    # Resolve TMDB IDs for each series
    result = []
    for sid, sdata in series.items():
        try:
            series_info = await _request(url, token, "GET", f"/Users/{user_id}/Items/{sid}", params={"Fields": "ProviderIds"})
            tmdb_id = series_info.get("ProviderIds", {}).get("Tmdb")
            if tmdb_id:
                sdata["tmdb_id"] = int(tmdb_id)
                # Sort episodes
                for s in sdata["episodes"]:
                    sdata["episodes"][s] = sorted(sdata["episodes"][s])
                result.append(sdata)
        except Exception:
            continue
    return result
