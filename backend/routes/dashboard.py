"""Dashboard aggregate endpoint."""
from __future__ import annotations

from fastapi import APIRouter

from backend.ml.predictor import ModelNotReadyError, get_metrics, headline_scores, status
from backend.services import dataset_service as ds
from backend.services.history_service import get_recent, get_statistics
from backend.utils.errors import service_unavailable

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", summary="Dashboard KPIs, chart series and recent predictions")
async def dashboard():
    """
    One round-trip for the whole dashboard.

    Metrics that depend on the trained model are returned as ``None`` (and the
    UI shows "Not available") rather than being invented when the model has not
    been trained yet.
    """
    kpis = ds.get_dashboard()

    try:
        metrics = get_metrics()
        model_block = {
            "ready": True,
            **headline_scores(metrics),
            "algorithm": metrics.get("model", {}).get("algorithm"),
            "n_features": metrics.get("n_features"),
            "train_samples": metrics.get("train_samples"),
            "test_samples": metrics.get("test_samples"),
            "trained_at": metrics.get("trained_at"),
        }
    except ModelNotReadyError:
        model_block = {
            "ready": False,
            "accuracy": None,
            "f1_score": None,
            "precision": None,
            "recall": None,
            "algorithm": None,
            "n_features": None,
            "train_samples": None,
            "test_samples": None,
            "trained_at": None,
        }

    history_stats = get_statistics()
    recent = get_recent(limit=6)

    clean = ds.load_clean()

    return {
        "kpis": {
            "total_records": kpis["total_records"],
            "training_records": kpis["training_records"],
            "averages": kpis["averages"],
            "predictions_made": history_stats["total"],
            "mean_confidence": history_stats["mean_confidence"],
            "accuracy": model_block["accuracy"],
        },
        "model": model_block,
        "history_statistics": history_stats,
        "recent_predictions": recent,
        "dataset": {
            "class_distribution": ds.get_class_distribution(),
            "correlation": ds.get_correlation(),
            "hourly_profile": ds.get_time_series(clean, "CO(GT)", "hour"),
            "temperature_profile": ds.get_time_series(clean, "T", "hour"),
            "humidity_profile": ds.get_time_series(clean, "RH", "hour"),
            "nox_profile": ds.get_time_series(clean, "NOx(GT)", "hour"),
            "scatter": ds.get_scatter(clean, limit=400)["pairs"],
            "date_range": kpis["date_range"],
        },
        "model_status": status(),
    }
