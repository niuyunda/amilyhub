from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://amily:alpha128128@localhost:55432/amilyhub"
    environment: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 18765
    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_allowed_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_allowed_origins")
    @classmethod
    def validate_cors_allowed_origins(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("cors_allowed_origins must not be empty")
        if "*" in value:
            raise ValueError("wildcard CORS is not allowed")
        return value


settings = Settings()
