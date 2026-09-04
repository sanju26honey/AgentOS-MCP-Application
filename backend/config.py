import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # Razorpay API Credentials
    RAZORPAY_KEY_ID: str = Field(default="rzp_test_placeholder_key")
    RAZORPAY_KEY_SECRET: str = Field(default="placeholder_secret_12345")
    RAZORPAY_WEBHOOK_SECRET: str = Field(default="placeholder_webhook_secret_67890")
    ENABLE_RAZORPAY_MOCK: bool = Field(default=True)

    # Merchant Policy Guardrails
    MAX_AUTONOMOUS_TXN_LIMIT: float = Field(default=5000.0)
    CURRENCY: str = Field(default="INR")
    MERCHANT_NAME: str = Field(default="Apex Fashion & Lifestyle Store")

    # Server Settings
    HOST: str = Field(default="127.0.0.1")
    PORT: int = Field(default=8080)
    ENVIRONMENT: str = Field(default="development")
    LOG_LEVEL: str = Field(default="info")
    # Database Settings
    DB_ENGINE: str = Field(default="postgresql")
    DB_PATH: str = Field(default=str(BASE_DIR / "backend" / "data" / "adapter.db"))
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)
    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="postgres")
    POSTGRES_DB: str = Field(default="razorpay_adapter")
    POSTGRES_URL: str = Field(default="")

    @property
    def database_url(self) -> str:
        if self.POSTGRES_URL:
            return self.POSTGRES_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
