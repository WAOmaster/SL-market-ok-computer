"""Configuration settings for the Market Price API."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings."""

    # Database
    DATABASE_URL: str = "sqlite:///./market_prices.db"

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    API_TITLE: str = "Sri Lanka Market Price API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Real-time market price tracking and prediction API for Sri Lankan markets"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8080,http://127.0.0.1:5500"

    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS origins string to list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Scraper
    SCRAPER_ENABLED: bool = True
    SCRAPER_INTERVAL_HOURS: int = 6

    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Prediction
    PREDICTION_DAYS: int = 7
    MIN_HISTORICAL_DAYS: int = 30

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
