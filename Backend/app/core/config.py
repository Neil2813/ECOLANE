from dataclasses import dataclass
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "EcoLens API")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@host:5432/ecolens")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "72"))
    ARGON2_TIME_COST: int = int(os.getenv("ARGON2_TIME_COST", "2"))
    ARGON2_MEMORY_COST: int = int(os.getenv("ARGON2_MEMORY_COST", "65536"))
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
    MOONDREAM_MODEL_URL: str = os.getenv("MOONDREAM_MODEL_URL", "https://api-inference.huggingface.co/models/vikhyatk/moondream2")
    OPENAQ_API_URL: str = os.getenv("OPENAQ_API_URL", "https://api.openaq.org/v2")
    CPCB_API_URL: str = os.getenv("CPCB_API_URL", "https://app.cpcbccr.com/aqi_dashboard/")
    NOMINATIM_URL: str = os.getenv("NOMINATIM_URL", "https://nominatim.openstreetmap.org")
    ERA5_DATA_PATH: str = os.getenv("ERA5_DATA_PATH", "./data/era5_latest.nc")
    OSM_GRAPH_PATH: str = os.getenv("OSM_GRAPH_PATH", "./data/bengaluru_osm.graphml")
    WEBPUSH_VAPID_PRIVATE_KEY: str = os.getenv("WEBPUSH_VAPID_PRIVATE_KEY", "")
    WEBPUSH_VAPID_PUBLIC_KEY: str = os.getenv("WEBPUSH_VAPID_PUBLIC_KEY", "")
    WEBPUSH_VAPID_EMAIL: str = os.getenv("WEBPUSH_VAPID_EMAIL", "mailto:team@ecolens.app")
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://ecolens.app")
    ENABLE_SCHEDULER: bool = os.getenv("ENABLE_SCHEDULER", "true").lower() == "true"

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
