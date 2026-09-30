from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/vibe_coding"
    supabase_url: str = "https://placeholder.supabase.co"
    supabase_anon_key: str = ""
    supabase_db_password: str = ""
    supabase_jwt_secret: str = ""
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174,"
        "http://localhost:5175,http://127.0.0.1:5175"
    )

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def jwt_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def resolved_database_url(self) -> str:
        password = self.supabase_db_password.strip()
        if not password:
            return self.database_url

        project_ref = self.supabase_url.removeprefix("https://").removesuffix(".supabase.co")
        encoded_password = quote_plus(password)
        return f"postgresql://postgres:{encoded_password}@db.{project_ref}.supabase.co:5432/postgres"


settings = Settings()
