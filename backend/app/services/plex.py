import logging
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

TIMEOUT = 10
PLEX_HEADERS = {"Accept": "application/json", "X-Plex-Client-Identifier": "watchlist-app"}


# --- Server Discovery ---


async def discover_servers(plex_token: str) -> list[dict]:
    """Discover all Plex servers available to this account (owned + shared)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://plex.tv/api/v2/resources",
            headers={**PLEX_HEADERS, "X-Plex-Token": plex_token},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        resources = resp.json()

    servers = []
    for r in resources:
        if r.get("provides") != "server":
            continue
        connections = r.get("connections", [])
        server_token = r.get("accessToken", plex_token)

        # Build candidate URLs, try to find one that works
        candidates = []
        for c in connections:
            proto = c.get("protocol", "http")
            port = c.get("port", 32400)
            # Fix: port 443 should always be https
            if port == 443:
                proto = "https"
            url = f"{proto}://{c.get('address')}:{port}"
            is_local = c.get("local", False)
            # Score: prefer external https > external http > local
            score = (0 if is_local else 2) + (1 if proto == "https" else 0)
            candidates.append((score, url))

        candidates.sort(key=lambda x: x[0], reverse=True)

        # Try best URL, fallback to next if it fails
        best_url = None
        for _, url in candidates:
            try:
                async with httpx.AsyncClient(verify=False) as test_client:
                    resp = await test_client.get(f"{url}/identity", headers={**PLEX_HEADERS, "X-Plex-Token": server_token}, timeout=3)
                    if resp.status_code == 200:
                        best_url = url
                        break
            except Exception:
                continue

        # If no URL responded, just use the highest scored one
        if not best_url and candidates:
            best_url = candidates[0][1]

        if not best_url:
            continue

        servers.append({
            "name": r.get("name", "Unknown"),
            "url": best_url,
            "owned": r.get("owned", False),
            "machine_id": r.get("clientIdentifier", ""),
            "token": server_token,
        })
    return servers


async def _request(url: str, token: str, path: str, params: dict | None = None) -> dict:
    headers = {**PLEX_HEADERS, "X-Plex-Token": token}
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.get(
            f"{url}{path}",
            headers=headers,
            params=params,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()


async def test_connection(url: str, token: str) -> dict:
    data = await _request(url, token, "/")
    mc = data.get("MediaContainer", {})
    return {
        "status": "ok",
        "name": mc.get("friendlyName", "Unknown"),
        "version": mc.get("version", "unknown"),
        "machine_id": mc.get("machineIdentifier", ""),
    }


async def get_libraries(url: str, token: str) -> list[dict]:
    data = await _request(url, token, "/library/sections")
    dirs = data.get("MediaContainer", {}).get("Directory", [])
    return [
        {
            "id": d.get("key"),
            "title": d.get("title"),
            "type": d.get("type"),  # movie, show, artist, photo
            "agent": d.get("agent"),
            "scanner": d.get("scanner"),
            "count": d.get("count", 0),
        }
        for d in dirs
    ]


async def get_library_items(url: str, token: str, library_id: str, start: int = 0, size: int = 50) -> dict:
    data = await _request(url, token, f"/library/sections/{library_id}/all", params={
        "X-Plex-Container-Start": start,
        "X-Plex-Container-Size": size,
    })
    mc = data.get("MediaContainer", {})
    items = mc.get("Metadata", [])
    return {
        "total": mc.get("totalSize", len(items)),
        "items": [_format_item(item) for item in items],
    }


async def search_library(url: str, token: str, query: str) -> list[dict]:
    data = await _request(url, token, "/search", params={"query": query})
    mc = data.get("MediaContainer", {})
    items = mc.get("Metadata", [])
    return [_format_item(item) for item in items]


async def get_metadata(url: str, token: str, rating_key: str) -> dict:
    data = await _request(url, token, f"/library/metadata/{rating_key}")
    items = data.get("MediaContainer", {}).get("Metadata", [])
    if not items:
        return {}
    return _format_item_detailed(items[0])


async def get_sessions(url: str, token: str) -> list[dict]:
    data = await _request(url, token, "/status/sessions")
    items = data.get("MediaContainer", {}).get("Metadata", [])
    return [
        {
            "title": s.get("title"),
            "grandparentTitle": s.get("grandparentTitle"),  # Series name for episodes
            "type": s.get("type"),
            "year": s.get("year"),
            "thumb": s.get("thumb"),
            "user": s.get("User", {}).get("title"),
            "player": s.get("Player", {}).get("title"),
            "platform": s.get("Player", {}).get("platform"),
            "state": s.get("Player", {}).get("state"),  # playing, paused, buffering
            "viewOffset": s.get("viewOffset", 0),
            "duration": s.get("duration", 0),
            "progress": round(s.get("viewOffset", 0) / max(s.get("duration", 1), 1) * 100),
            "transcodeSession": bool(s.get("TranscodeSession")),
        }
        for s in items
    ]


async def get_on_deck(url: str, token: str) -> list[dict]:
    data = await _request(url, token, "/library/onDeck")
    items = data.get("MediaContainer", {}).get("Metadata", [])
    return [_format_item(item) for item in items[:20]]


async def get_history(url: str, token: str, start: int = 0, size: int = 50) -> dict:
    data = await _request(url, token, "/status/sessions/history/all", params={
        "X-Plex-Container-Start": start,
        "X-Plex-Container-Size": size,
        "sort": "viewedAt:desc",
    })
    mc = data.get("MediaContainer", {})
    items = mc.get("Metadata", [])
    return {
        "total": mc.get("totalSize", len(items)),
        "items": [
            {
                "title": h.get("title"),
                "grandparentTitle": h.get("grandparentTitle"),
                "type": h.get("type"),
                "thumb": h.get("thumb"),
                "viewedAt": h.get("viewedAt"),
                "accountID": h.get("accountID"),
            }
            for h in items
        ],
    }


async def find_by_guid(url: str, token: str, tmdb_id: int, media_type: str) -> dict | None:
    """Find an item on Plex by TMDB ID. Searches all matching libraries."""
    libraries = await get_libraries(url, token)
    plex_type = "movie" if media_type == "movie" else "show"
    target_guid = f"tmdb://{tmdb_id}"

    for lib in libraries:
        if lib["type"] != plex_type:
            continue

        # Method 1: Direct GUID filter (works on some servers)
        try:
            data = await _request(url, token, f"/library/sections/{lib['id']}/all", params={"guid": target_guid})
            items = data.get("MediaContainer", {}).get("Metadata", [])
            if items:
                return _format_item_detailed(items[0])
        except Exception:
            pass

        # Method 2: Scan with includeGuids and match
        try:
            page = 0
            while True:
                data = await _request(url, token, f"/library/sections/{lib['id']}/all", params={
                    "X-Plex-Container-Start": page, "X-Plex-Container-Size": 200, "includeGuids": 1,
                })
                items = data.get("MediaContainer", {}).get("Metadata", [])
                if not items:
                    break
                for item in items:
                    for g in item.get("Guid", []):
                        if g.get("id") == target_guid:
                            return _format_item_detailed(item)
                page += 200
                if len(items) < 200:
                    break
        except Exception:
            pass

    return None


# --- Scrobble (mark as watched/unwatched) ---


async def _scrobble(url: str, token: str, rating_key: str) -> None:
    """Scrobble a single item."""
    headers = {**PLEX_HEADERS, "X-Plex-Token": token}
    async with httpx.AsyncClient(verify=False) as client:
        await client.get(
            f"{url}/:/scrobble",
            headers=headers,
            params={"identifier": "com.plexapp.plugins.library", "key": rating_key},
            timeout=TIMEOUT,
        )


async def _unscrobble(url: str, token: str, rating_key: str) -> None:
    """Unscrobble a single item."""
    headers = {**PLEX_HEADERS, "X-Plex-Token": token}
    async with httpx.AsyncClient(verify=False) as client:
        await client.get(
            f"{url}/:/unscrobble",
            headers=headers,
            params={"identifier": "com.plexapp.plugins.library", "key": rating_key},
            timeout=TIMEOUT,
        )


async def _get_all_episodes(url: str, token: str, show_rating_key: str) -> list[str]:
    """Get all episode rating keys for a TV show."""
    episode_keys = []
    try:
        # Get seasons
        data = await _request(url, token, f"/library/metadata/{show_rating_key}/children")
        seasons = data.get("MediaContainer", {}).get("Metadata", [])
        for season in seasons:
            # Get episodes per season
            try:
                ep_data = await _request(url, token, f"/library/metadata/{season['ratingKey']}/children")
                episodes = ep_data.get("MediaContainer", {}).get("Metadata", [])
                for ep in episodes:
                    if ep.get("ratingKey"):
                        episode_keys.append(ep["ratingKey"])
            except Exception:
                continue
    except Exception:
        pass
    return episode_keys


async def mark_watched(url: str, token: str, rating_key: str, media_type: str = "movie") -> None:
    """Mark an item as fully watched on Plex. For TV shows, marks all episodes."""
    if media_type in ("show", "tv"):
        # Get all episodes and scrobble each
        episode_keys = await _get_all_episodes(url, token, rating_key)
        if episode_keys:
            for ek in episode_keys:
                try:
                    await _scrobble(url, token, ek)
                except Exception:
                    continue
            return
    # Movie or fallback
    await _scrobble(url, token, rating_key)


async def mark_unwatched(url: str, token: str, rating_key: str, media_type: str = "movie") -> None:
    """Mark an item as unwatched on Plex. For TV shows, marks all episodes."""
    if media_type in ("show", "tv"):
        episode_keys = await _get_all_episodes(url, token, rating_key)
        if episode_keys:
            for ek in episode_keys:
                try:
                    await _unscrobble(url, token, ek)
                except Exception:
                    continue
            return
    await _unscrobble(url, token, rating_key)


# --- Plex Cloud Watchlist (plex.tv) ---

DISCOVER_BASE = "https://discover.provider.plex.tv"


async def get_plex_watchlist(plex_token: str) -> list[dict]:
    """Get all items on the user's Plex Watchlist."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{DISCOVER_BASE}/library/sections/watchlist/all",
            headers={**PLEX_HEADERS, "X-Plex-Token": plex_token},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json().get("MediaContainer", {}).get("Metadata", [])


async def find_on_plex_discover(plex_token: str, title: str, media_type: str, year: int | None = None) -> str | None:
    """Search Plex's metadata provider to get a ratingKey for watchlist operations."""
    plex_type = 1 if media_type == "movie" else 2  # 1=movie, 2=show
    params = {"title": title, "type": plex_type}
    if year:
        params["year"] = year
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{DISCOVER_BASE}/library/metadata/matches",
            params=params,
            headers={**PLEX_HEADERS, "X-Plex-Token": plex_token},
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        items = resp.json().get("MediaContainer", {}).get("Metadata", [])
        if items:
            return items[0].get("ratingKey")
    return None


async def add_to_plex_watchlist(plex_token: str, rating_key: str) -> bool:
    """Add an item to the user's Plex Watchlist."""
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{DISCOVER_BASE}/actions/addToWatchlist",
            params={"ratingKey": rating_key},
            headers={**PLEX_HEADERS, "X-Plex-Token": plex_token},
            timeout=TIMEOUT,
        )
        return resp.status_code == 200


async def remove_from_plex_watchlist(plex_token: str, rating_key: str) -> bool:
    """Remove an item from the user's Plex Watchlist."""
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{DISCOVER_BASE}/actions/removeFromWatchlist",
            params={"ratingKey": rating_key},
            headers={**PLEX_HEADERS, "X-Plex-Token": plex_token},
            timeout=TIMEOUT,
        )
        return resp.status_code == 200


async def get_watch_history_recent(url: str, token: str, minutes: int = 60) -> list[dict]:
    """Get recently watched items (for sync polling)."""
    import time
    since = int(time.time()) - (minutes * 60)
    data = await _request(url, token, "/status/sessions/history/all", params={
        "X-Plex-Container-Start": 0,
        "X-Plex-Container-Size": 50,
        "sort": "viewedAt:desc",
        "viewedAt>": since,
    })
    mc = data.get("MediaContainer", {})
    items = mc.get("Metadata", [])
    return [
        {
            "ratingKey": h.get("ratingKey"),
            "title": h.get("title"),
            "grandparentTitle": h.get("grandparentTitle"),
            "type": h.get("type"),
            "viewedAt": h.get("viewedAt"),
            "guids": [g.get("id") for g in h.get("Guid", [])],
        }
        for h in items
    ]


def _format_item(item: dict) -> dict:
    return {
        "ratingKey": item.get("ratingKey"),
        "title": item.get("title"),
        "grandparentTitle": item.get("grandparentTitle"),
        "type": item.get("type"),
        "year": item.get("year"),
        "thumb": item.get("thumb"),
        "viewCount": item.get("viewCount", 0),
        "lastViewedAt": item.get("lastViewedAt"),
        "addedAt": item.get("addedAt"),
        "duration": item.get("duration"),
        "rating": item.get("rating"),
    }


def _format_item_detailed(item: dict) -> dict:
    base = _format_item(item)
    media = item.get("Media", [{}])
    if media:
        m = media[0]
        base["videoResolution"] = m.get("videoResolution")
        base["videoCodec"] = m.get("videoCodec")
        base["audioCodec"] = m.get("audioCodec")
        base["audioChannels"] = m.get("audioChannels")
        base["container"] = m.get("container")
        base["bitrate"] = m.get("bitrate")
        parts = m.get("Part", [{}])
        if parts:
            base["fileSize"] = parts[0].get("size")
            base["filePath"] = parts[0].get("file")
    base["summary"] = item.get("summary")
    base["contentRating"] = item.get("contentRating")
    base["studio"] = item.get("studio")
    base["guid"] = item.get("guid")
    base["guids"] = [{"id": g.get("id")} for g in item.get("Guid", [])]
    return base
