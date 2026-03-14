import httpx

from ..config import get_settings

settings = get_settings()
BASE = "https://api.themoviedb.org/3"


class TMDBService:
    def __init__(self):
        self.headers = {
            "Authorization": f"Bearer {settings.tmdb_access_token}",
            "Accept": "application/json",
        }

    async def _get(self, path: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BASE}{path}", headers=self.headers, params=params or {}, timeout=10)
            resp.raise_for_status()
            return resp.json()

    async def search(self, query: str) -> dict:
        return await self._get("/search/multi", {"query": query, "language": "de-DE"})

    async def trending(self, page: int = 1) -> dict:
        return await self._get("/trending/all/week", {"page": page, "language": "de-DE"})

    async def upcoming(self, page: int = 1) -> dict:
        return await self._get("/movie/upcoming", {"page": page, "language": "de-DE"})

    async def details(self, media_type: str, tmdb_id: int) -> dict:
        return await self._get(f"/{media_type}/{tmdb_id}", {"language": "de-DE", "append_to_response": "credits,videos"})
