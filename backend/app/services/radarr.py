import logging

import httpx

logger = logging.getLogger(__name__)

TIMEOUT = 15
TIMEOUT_LONG = 60


async def _request(
    url: str,
    api_key: str,
    method: str,
    path: str,
    json: dict | None = None,
    params: dict | None = None,
    timeout: int = TIMEOUT,
) -> dict | list:
    headers = {"X-Api-Key": api_key}
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.request(
            method,
            f"{url}/api/v3{path}",
            headers=headers,
            json=json,
            params=params,
            timeout=timeout,
        )
        resp.raise_for_status()
        if resp.status_code == 204 or not resp.content:
            return {}
        try:
            return resp.json()
        except Exception:
            return {}


# --- Connection / System ---


async def test_connection(url: str, api_key: str) -> dict:
    data = await _request(url, api_key, "GET", "/system/status")
    return {"status": "ok", "version": data.get("version", "unknown")}


async def get_disk_space(url: str, api_key: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/diskspace")


async def get_tags(url: str, api_key: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/tag")


# --- Movies ---


async def lookup_by_tmdb(url: str, api_key: str, tmdb_id: int) -> list[dict]:
    return await _request(url, api_key, "GET", "/movie/lookup", params={"term": f"tmdb:{tmdb_id}"})


async def get_all_movies(url: str, api_key: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/movie")


async def get_movie(url: str, api_key: str, movie_id: int) -> dict:
    return await _request(url, api_key, "GET", f"/movie/{movie_id}")


async def get_movie_by_tmdb(url: str, api_key: str, tmdb_id: int) -> dict | None:
    all_movies = await get_all_movies(url, api_key)
    for m in all_movies:
        if m.get("tmdbId") == tmdb_id:
            return m
    return None


async def add_movie(url: str, api_key: str, data: dict) -> dict:
    return await _request(url, api_key, "POST", "/movie", json=data)


async def update_movie(url: str, api_key: str, data: dict) -> dict:
    return await _request(url, api_key, "PUT", f"/movie/{data['id']}", json=data)


async def delete_movie(url: str, api_key: str, movie_id: int, delete_files: bool = False) -> dict:
    return await _request(url, api_key, "DELETE", f"/movie/{movie_id}", params={"deleteFiles": delete_files, "addImportExclusion": False})


# --- Movie File ---


async def get_movie_files(url: str, api_key: str, movie_id: int) -> list[dict]:
    return await _request(url, api_key, "GET", "/moviefile", params={"movieId": movie_id})


async def delete_movie_file(url: str, api_key: str, file_id: int) -> dict:
    return await _request(url, api_key, "DELETE", f"/moviefile/{file_id}")


# --- Releases / Manual Search ---


async def search_releases(url: str, api_key: str, movie_id: int) -> list[dict]:
    return await _request(url, api_key, "GET", "/release", params={"movieId": movie_id}, timeout=TIMEOUT_LONG)


async def grab_release(url: str, api_key: str, guid: str, indexer_id: int) -> dict:
    return await _request(url, api_key, "POST", "/release", json={"guid": guid, "indexerId": indexer_id})


# --- Commands ---


async def run_command(url: str, api_key: str, command: dict) -> dict:
    return await _request(url, api_key, "POST", "/command", json=command)


async def movie_search(url: str, api_key: str, movie_ids: list[int]) -> dict:
    return await run_command(url, api_key, {"name": "MoviesSearch", "movieIds": movie_ids})


# --- Queue ---


async def get_queue(url: str, api_key: str, page: int = 1, page_size: int = 50) -> dict:
    return await _request(
        url, api_key, "GET", "/queue",
        params={"page": page, "pageSize": page_size, "includeMovie": "true"},
    )


async def remove_from_queue(url: str, api_key: str, queue_id: int, blocklist: bool = False) -> dict:
    return await _request(
        url, api_key, "DELETE", f"/queue/{queue_id}",
        params={"removeFromClient": True, "blocklist": blocklist},
    )


# --- History ---


async def get_history(url: str, api_key: str, movie_id: int | None = None, page: int = 1, page_size: int = 50) -> dict:
    if movie_id is not None:
        return await _request(url, api_key, "GET", "/history/movie", params={"movieId": movie_id})
    return await _request(url, api_key, "GET", "/history", params={"page": page, "pageSize": page_size, "sortKey": "date", "sortDirection": "descending"})


# --- Profiles & Folders ---


async def get_root_folders(url: str, api_key: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/rootfolder")


async def get_quality_profiles(url: str, api_key: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/qualityprofile")
