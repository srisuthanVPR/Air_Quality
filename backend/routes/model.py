"""Model information, feature schema and evaluation metrics."""
from __future__ import annotations

from fastapi import APIRouter

from backend.ml.config import (
    ALGORITHM,
    ALGORITHM_LABEL,
    CLASS_AUDIENCE,
    CLASS_COLORS,
    CLASS_LABELS,
    CLASS_ORDER,
    CLASS_RECOMMENDATIONS,
    CLASS_RULE_TEXT,
    DATASET_NAME,
    EXCLUDED_COLUMNS,
    FEATURES,
    FEATURE_META,
    GROUP_LABELS,
    HOW_IT_WORKS,
    MODEL_DESCRIPTION,
    MODEL_NAME,
    WORKFLOW_STEPS,
)
from backend.ml.predictor import (
    ModelNotReadyError,
    feature_schema,
    get_metrics,
    headline_scores,
    status,
)
from backend.services.history_service import get_statistics
from backend.utils.errors import service_unavailable

router = APIRouter(prefix="/model", tags=["model"])


def _metrics_or_503() -> dict:
    try:
        return get_metrics()
    except ModelNotReadyError as exc:
        raise service_unavailable(
            "The model has not been trained yet.",
            str(exc),
        ) from exc


@router.get("/info", summary="Model overview and how the prediction works")
async def model_info():
    metrics = _metrics_or_503()
    model_meta = metrics.get("model", {})

    return {
        "name": model_meta.get("name", MODEL_NAME),
        "algorithm": model_meta.get("algorithm", ALGORITHM),
        "algorithm_label": ALGORITHM_LABEL,
        "dataset": model_meta.get("dataset", DATASET_NAME),
        "description": MODEL_DESCRIPTION,
        "problem_type": "Multi-class classification",
        "classes": [
            {
                "id": cls,
                "label": CLASS_LABELS[cls],
                "color": CLASS_COLORS[cls],
                "audience": CLASS_AUDIENCE[cls],
                "recommendation": CLASS_RECOMMENDATIONS[cls],
            }
            for cls in CLASS_ORDER
        ],
        "features": feature_schema(),
        "feature_count": len(FEATURES),
        "excluded_columns": EXCLUDED_COLUMNS,
        "target_rule": CLASS_RULE_TEXT,
        "uses_scaler": model_meta.get("uses_scaler", True),
        "trained_at": metrics.get("trained_at"),
        "environment": metrics.get("environment"),
    }


@router.get("/features", summary="Field definitions that drive the prediction form")
async def model_features():
    """Single source of truth for the UI form: names, units, ranges and hints."""
    schema = feature_schema()
    grouped: dict[str, list] = {}
    for item in schema:
        grouped.setdefault(item["group"], []).append(item)
    return {
        "features": schema,
        "groups": [
            {"key": key, "label": GROUP_LABELS.get(key, key.title()), "count": len(items)}
            for key, items in grouped.items()
        ],
        "excluded_columns": EXCLUDED_COLUMNS,
        "defaults": {
            item["name"]: item["placeholder"] for item in schema if item["placeholder"] is not None
        },
    }


@router.get("/metrics", summary="Real evaluation metrics from the trained model")
async def model_metrics():
    """Everything on the Model Performance page is read from here."""
    metrics = _metrics_or_503()
    model_meta = metrics.get("model", {})
    split = metrics.get("split", {})
    scores = headline_scores(metrics)

    return {
        "problem_type": "classification",
        "algorithm": model_meta.get("algorithm", ALGORITHM),
        "algorithm_label": ALGORITHM_LABEL,
        "params": model_meta.get("params", {}),
        **scores,
        "averaging": "weighted",
        "per_class": metrics.get("per_class", []),
        "confusion_matrix": metrics.get("confusion_matrix", []),
        "confusion_matrix_normalized": metrics.get("confusion_matrix_normalized", []),
        "confusion_labels": metrics.get("confusion_labels", []),
        "feature_importances": metrics.get("feature_importances", {}),
        "model_comparison": metrics.get("model_comparison", []),
        "split": split,
        "train_samples": split.get("train_samples"),
        "test_samples": split.get("test_samples"),
        "total_samples": split.get("total_samples"),
        "n_features": metrics.get("n_features", len(FEATURES)),
        "features": metrics.get("features", FEATURES),
        "class_distribution": metrics.get("class_distribution", {}),
        "dataset_stats": metrics.get("dataset_stats", {}),
        "trained_at": metrics.get("trained_at"),
        "environment": metrics.get("environment", {}),
        "history": get_statistics(),
        "model_status": status(),
    }


@router.get("/workflow", summary="The end-to-end ML workflow used by this project")
async def model_workflow():
    return {
        "steps": WORKFLOW_STEPS,
        "details": HOW_IT_WORKS,
        "target_rule": CLASS_RULE_TEXT,
        "feature_groups": [
            {"key": key, "label": GROUP_LABELS[key], "features": [f.name for f in FEATURE_META if f.group == key]}
            for key in GROUP_LABELS
        ],
    }
