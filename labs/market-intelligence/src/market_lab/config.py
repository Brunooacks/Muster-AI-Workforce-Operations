from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://market_lab:market_lab@localhost:5442/market_lab"
    openai_api_key: str | None = None
    llm_model: str = "gpt-5-mini"
    llm_base_url: str | None = None
    tavily_api_key: str | None = None
    daily_run_hour: int = Field(default=2, ge=0, le=23)
    daily_run_minute: int = Field(default=30, ge=0, le=59)
    timezone: str = "America/Sao_Paulo"
    run_on_start: bool = True
    max_items_per_source: int = Field(default=300, ge=1, le=1000)
    max_enrichment_items: int = Field(default=30, ge=0, le=200)
    max_market_searches: int = Field(default=8, ge=0, le=50)
    request_timeout_seconds: float = Field(default=30, gt=0, le=120)
    user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
    )

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
