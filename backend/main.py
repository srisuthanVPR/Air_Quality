"""
Air Quality Intelligence — FastAPI application entrypoint.

Start it with::

    uvicorn backend.main:app --reload --port 8000

Startup order matters: the SQLite schema is created first, then the trained
model, scaler and metrics are loaded into memory once. Predictions afterwards
never touch the filesystem.
"""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Allow `uvicorn backend.main:app` as well as `python backend/main.py`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.middleware.gzip import GZipMiddleware  # noqa: E402

from backend.config import (  # noqa: E402
    APP_NAME,
    APP_VERSION,
    CORS_ORIGINS,
    DATA_PATH,
    MODEL_PATH,
)
from backend.ml.predictor import (  # noqa: E402
    ModelNotReadyError,
    headline_scores,
    load_artifacts,
    status,
)
from backend.routes.analytics import router as analytics_router  # noqa: E402
from backend.routes.batch import router as batch_router  # noqa: E402
from backend.routes.dashboard import router as dashboard_router  # noqa: E402
from backend.routes.dataset import router as dataset_router  # noqa: E402
from backend.routes.history import router as history_router  # noqa: E402
from backend.routes.model import router as model_router  # noqa: E402
from backend.routes.predict import router as predict_router  # noqa: E402
from backend.services import dataset_service as dataset_service  # noqa: E402
from backend.services.history_service import init_db  # noqa: E402
from backend.utils.errors import register_exception_handlers  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("airquality")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up the database and the model before serving traffic."""
    init_db()
    logger.info("Prediction history database ready")

    try:
        metrics = load_artifacts(force=True)
        logger.info(
            "Model ready: %s, accuracy=%s, trained_at=%s",
            (metrics.get("model") or {}).get("algorithm", "unknown"),
            headline_scores(metrics).get("accuracy", "n/a"),
            metrics.get("trained_at"),
        )
    except ModelNotReadyError as exc:
        # The API still starts so the frontend can explain the problem instead
        # of the whole stack failing to boot.
        logger.warning("Model not loaded: %s", exc)

    try:
        dataset_service.load_dataset()
        logger.info("Dataset ready: %s", DATA_PATH.name)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Dataset unavailable: %s", exc)

    yield

    logger.info("Shutting down")


DESCRIPTION = """
Machine-learning API for the Air Quality Intelligence platform.

* **Predict** air quality from 12 pollutant / sensor / meteorological readings
* **Batch predict** an uploaded CSV and download the scored file
* **Explore** the AirQualityUCI dataset with server-side pagination and search
* **Analytics** aggregates for trends, distributions and correlation
* **Model** information, the prediction form schema and real evaluation metrics

Every response value is computed from the trained artifacts or the dataset.
Fields that cannot be computed are returned as `null` so the UI can render
"Not available" instead of guessing.
"""


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,
)
# Dataset JSON payloads are large and compress extremely well.
app.add_middleware(GZipMiddleware, minimum_size=1024)

register_exception_handlers(app)


@app.get("/api/health", tags=["system"], summary="Liveness and dependency status")
async def health():
    """Used by the frontend to show Backend: Online / Offline in the sidebar."""
    dataset_ok = dataset_service.dataset_available()
    model_status = status()
    ready = dataset_ok and model_status["ready"]
    return {
        "status": "ok" if ready else "degraded",
        "message": (
            "Air Quality Intelligence API is running"
            if ready
            else "API is running but some components are not ready"
        ),
        "version": APP_VERSION,
        "dataset_available": dataset_ok,
        "model": model_status,
        "model_path": str(MODEL_PATH),
    }


@app.get("/api", tags=["system"], summary="Endpoint index")
async def api_index():
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "docs": "/docs",
        "endpoints": {
            "predict": "/api/predict",
            "batch_predict": "/api/predict/batch",
            "batch_download": "/api/predict/batch/{job_id}/download",
            "sample_csv": "/api/predict/sample-csv",
            "dashboard": "/api/dashboard",
            "dataset_summary": "/api/dataset/summary",
            "dataset_rows": "/api/dataset/sample",
            "dataset_correlation": "/api/dataset/correlation",
            "dataset_download": "/api/dataset/download",
            "analytics": "/api/analytics",
            "model_info": "/api/model/info",
            "model_features": "/api/model/features",
            "model_metrics": "/api/model/metrics",
            "model_workflow": "/api/model/workflow",
            "history": "/api/history",
        },
    }


app.include_router(predict_router, prefix="/api")
app.include_router(batch_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(dataset_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(model_router, prefix="/api")
app.include_router(history_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
