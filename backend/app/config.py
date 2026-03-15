from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/watchlist"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 43200  # 30 days
    tmdb_api_key: str = ""
    tmdb_access_token: str = ""
    cors_allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
