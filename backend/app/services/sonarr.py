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


# --- Series ---


async def lookup_by_tmdb(url: str, api_key: str, tmdb_id: int) -> list[dict]:
    return await _request(url, api_key, "GET", "/series/lookup", params={"term": f"tmdb:{tmdb_id}"})


async def get_all_series(url: str, api_key: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/series")


async def get_series(url: str, api_key: str, series_id: int) -> dict:
    return await _request(url, api_key, "GET", f"/series/{series_id}")


async def get_series_by_tmdb(url: str, api_key: str, tmdb_id: int) -> dict | None:
    all_series = await get_all_series(url, api_key)
    for s in all_series:
        if s.get("tmdbId") == tmdb_id:
            return s
    return None


async def add_series(url: str, api_key: str, data: dict) -> dict:
    return await _request(url, api_key, "POST", "/series", json=data)


async def update_series(url: str, api_key: str, data: dict) -> dict:
    return await _request(url, api_key, "PUT", f"/series/{data['id']}", json=data)


async def delete_series(url: str, api_key: str, series_id: int, delete_files: bool = False) -> dict:
    return await _request(url, api_key, "DELETE", f"/series/{series_id}", params={"deleteFiles": delete_files})


# --- Episodes ---


async def get_episodes(url: str, api_key: str, series_id: int) -> list[dict]:
    return await _request(url, api_key, "GET", "/episode", params={"seriesId": series_id})


async def set_episode_monitor(url: str, api_key: str, episode_ids: list[int], monitored: bool) -> list[dict]:
    return await _request(url, api_key, "PUT", "/episode/monitor", json={"episodeIds": episode_ids, "monitored": monitored})


async def get_episode_files(url: str, api_key: str, series_id: int) -> list[dict]:
    return await _request(url, api_key, "GET", "/episodefile", params={"seriesId": series_id})


async def delete_episode_file(url: str, api_key: str, file_id: int) -> dict:
    return await _request(url, api_key, "DELETE", f"/episodefile/{file_id}")


# --- Releases / Manual Search ---


async def search_releases(
    url: str,
    api_key: str,
    episode_id: int | None = None,
    series_id: int | None = None,
    season_number: int | None = None,
) -> list[dict]:
    params = {}
    if episode_id is not None:
        params["episodeId"] = episode_id
    if series_id is not None:
        params["seriesId"] = series_id
    if season_number is not None:
        params["seasonNumber"] = season_number
    return await _request(url, api_key, "GET", "/release", params=params, timeout=TIMEOUT_LONG)


async def grab_release(url: str, api_key: str, guid: str, indexer_id: int) -> dict:
    return await _request(url, api_key, "POST", "/release", json={"guid": guid, "indexerId": indexer_id})


# --- Commands ---


async def run_command(url: str, api_key: str, command: dict) -> dict:
    return await _request(url, api_key, "POST", "/command", json=command)


async def episode_search(url: str, api_key: str, episode_ids: list[int]) -> dict:
    return await run_command(url, api_key, {"name": "EpisodeSearch", "episodeIds": episode_ids})


async def season_search(url: str, api_key: str, series_id: int, season_number: int) -> dict:
    return await run_command(url, api_key, {"name": "SeasonSearch", "seriesId": series_id, "seasonNumber": season_number})


async def trigger_search(url: str, api_key: str, series_id: int) -> dict:
    return await run_command(url, api_key, {"name": "SeriesSearch", "seriesId": series_id})


async def rename_files(url: str, api_key: str, series_id: int, file_ids: list[int]) -> dict:
    return await run_command(url, api_key, {"name": "RenameFiles", "seriesId": series_id, "files": file_ids})


async def rescan_series(url: str, api_key: str, series_id: int) -> dict:
    return await run_command(url, api_key, {"name": "RescanSeries", "seriesId": series_id})


# --- Queue ---


async def get_queue(url: str, api_key: str, page: int = 1, page_size: int = 50) -> dict:
    return await _request(
        url, api_key, "GET", "/queue",
        params={"page": page, "pageSize": page_size, "includeEpisode": "true", "includeSeries": "true"},
    )


async def remove_from_queue(url: str, api_key: str, queue_id: int, blocklist: bool = False) -> dict:
    return await _request(
        url, api_key, "DELETE", f"/queue/{queue_id}",
        params={"removeFromClient": True, "blocklist": blocklist},
    )


# --- History ---


async def get_history(url: str, api_key: str, series_id: int | None = None, episode_id: int | None = None, page: int = 1, page_size: int = 50) -> dict:
    if series_id is not None:
        return await _request(url, api_key, "GET", f"/history/series", params={"seriesId": series_id})
    params = {"page": page, "pageSize": page_size, "sortKey": "date", "sortDirection": "descending"}
    if episode_id is not None:
        params["episodeId"] = episode_id
    return await _request(url, api_key, "GET", "/history", params=params)


# --- Calendar ---


async def get_calendar(url: str, api_key: str, start: str, end: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/calendar", params={"start": start, "end": end, "includeSeries": "true"})


# --- Wanted ---


async def get_wanted_missing(url: str, api_key: str, page: int = 1, page_size: int = 50) -> dict:
    return await _request(
        url, api_key, "GET", "/wanted/missing",
        params={"page": page, "pageSize": page_size, "sortKey": "airDateUtc", "sortDirection": "descending", "includeSeries": "true"},
    )


async def get_cutoff_unmet(url: str, api_key: str, page: int = 1, page_size: int = 50) -> dict:
    return await _request(
        url, api_key, "GET", "/wanted/cutoff",
        params={"page": page, "pageSize": page_size, "sortKey": "airDateUtc", "sortDirection": "descending", "includeSeries": "true"},
    )


# --- Profiles & Folders ---


async def get_root_folders(url: str, api_key: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/rootfolder")


async def get_quality_profiles(url: str, api_key: str) -> list[dict]:
    return await _request(url, api_key, "GET", "/qualityprofile")
