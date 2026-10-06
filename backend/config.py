"""
Application settings, resolved from environment variables.

All filesystem locations and network settings live here so that the rest of the
codebase never reads ``os.environ`` directly. Copy ``backend/.env.example`` to
``backend/.env`` (or a repo-root ``.env``) to override any value.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# <repo>/backend/config.py -> <repo>
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

# Load repo-root .env first, then backend/.env so a local override wins.
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")


def _env_path(name: str, default: Path) -> Path:
    raw = os.getenv(name)
    return Path(raw).expanduser().resolve() if raw else default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_sqlite_path(name: str, default: Path) -> Path:
    """Accept both a plain path and a ``sqlite:///abs/path`` DSN."""
    raw = os.getenv(name)
    if not raw:
        return default
    for prefix in ("sqlite+aiosqlite:///", "sqlite:///"):
        if raw.startswith(prefix):
            raw = raw[len(prefix) :]
            break
    if raw in {":memory:", ""}:
        return default
    return Path(raw).expanduser().resolve()


# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
DATA_PATH: Path = _env_path("DATA_PATH", ROOT_DIR / "data" / "AirQualityUCI.csv")
MODEL_DIR: Path = _env_path("MODEL_DIR", ROOT_DIR / "models")
MODEL_PATH: Path = _env_path("MODEL_PATH", MODEL_DIR / "model.pkl")
SCALER_PATH: Path = _env_path("SCALER_PATH", MODEL_DIR / "scaler.pkl")
METRICS_PATH: Path = _env_path("METRICS_PATH", MODEL_DIR / "metrics.json")
DB_PATH: Path = _env_sqlite_path("DATABASE_URL", MODEL_DIR / "history.db")

# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #
APP_NAME = "Air Quality Intelligence API"
APP_VERSION = "1.1.0"

_default_origins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

# --------------------------------------------------------------------------- #
# Upload / batch safety limits
# --------------------------------------------------------------------------- #
MAX_UPLOAD_BYTES: int = _env_int("MAX_UPLOAD_BYTES", 10 * 1024 * 1024)  # 10 MB
MAX_BATCH_ROWS: int = _env_int("MAX_BATCH_ROWS", 20_000)
BATCH_JOB_TTL_SECONDS: int = _env_int("BATCH_JOB_TTL_SECONDS", 900)  # 15 min
MAX_BATCH_PREVIEW_ROWS: int = 100

ALLOWED_UPLOAD_SUFFIXES: frozenset[str] = frozenset({".csv"})
ALLOWED_UPLOAD_CONTENT_TYPES: frozenset[str] = frozenset(
    {
        "text/csv",
        "application/csv",
        "text/plain",
        "application/vnd.ms-excel",
        "application/octet-stream",
    }
)

# Dataset rows served per page in the Dataset Explorer.
DEFAULT_PAGE_SIZE: int = 50
MAX_PAGE_SIZE: int = 200
