"""Application configuration."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://tradein:tradein@localhost:5433/tradein"
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    admin_emails: str = "tomerbardao@tradein.local"
    # Optional: comma-separated extra origins (e.g. https://your-app.vercel.app)
    frontend_url: str = ""
    # KSP blocks many cloud/datacenter IPs — route via ScraperAPI or custom proxy on Render.
    ksp_scraper_api_key: str = ""
    ksp_https_proxy: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.frontend_url.strip():
            origins.append(self.frontend_url.strip().rstrip("/"))
        # De-dupe while preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for o in origins:
            if o not in seen:
                seen.add(o)
                unique.append(o)
        return unique

    @property
    def admin_email_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def load_companies_config() -> dict:
    path = CONFIG_DIR / "companies.yaml"
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)
