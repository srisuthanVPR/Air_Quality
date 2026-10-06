"""
Inference layer: loads the persisted artifacts once and turns sensor readings
into an air-quality prediction.

The model and scaler are loaded at application startup (``backend.main``) and
kept in memory, so a prediction is a matrix transform plus a forest forward
pass — no retraining, no disk I/O per request.

Two correctness details matter here:

1. **Identical preprocessing.** Training imputed missing values with the
   training median (``metrics.json -> training_medians``). Inference uses the
   exact same medians, so the model never sees an input shape it was not
   trained on. (The previous version substituted ``0``, which silently created
   train/serve skew.)
2. **Honest explainability.** ``feature_importances`` alone would look
   identical for every prediction. Per-request contributions are estimated as
   ``importance × z-score of the reading`` and are labelled as an estimate.
"""
from __future__ import annotations

import json
import math
import threading
from typing import Mapping

import joblib
import numpy as np
import pandas as pd

from backend.config import METRICS_PATH, MODEL_PATH, SCALER_PATH
from backend.ml.config import (
    CLASS_COLORS,
    CLASS_LABELS,
    CLASS_ORDER,
    CLASS_RECOMMENDATIONS,
    FEATURES,
    FEATURE_BY_NAME,
    FEATURE_META,
    MISSING_SENTINEL,
)

_LOCK = threading.Lock()
_model = None
_scaler = None
_metrics: dict | None = None
_loaded_at: str | None = None


class ModelNotReadyError(RuntimeError):
    """Raised when the artifacts have not been trained or cannot be loaded."""


class PredictionError(ValueError):
    """Raised when user-supplied readings fail validation."""

    def __init__(self, message: str, errors: list[dict] | None = None):
        super().__init__(message)
        self.message = message
        self.errors = errors or []


# --------------------------------------------------------------------------- #
# Artifact lifecycle
# --------------------------------------------------------------------------- #
def load_artifacts(force: bool = False) -> dict:
    """Load model + scaler + metrics into memory. Safe to call repeatedly."""
    global _model, _scaler, _metrics, _loaded_at

    with _LOCK:
        if _model is not None and not force:
            return _metrics or {}

        missing = [p.name for p in (MODEL_PATH, SCALER_PATH, METRICS_PATH) if not p.exists()]
        if missing:
            raise ModelNotReadyError(
                f"Missing model artifact(s): {', '.join(missing)}. "
                "Run 'python -m backend.ml.train' first."
            )

        try:
            model = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - depends on artifact state
            raise ModelNotReadyError(
                f"Could not load the trained model ({exc}). "
                "Re-run 'python -m backend.ml.train' to regenerate the artifacts."
            ) from exc

        if getattr(scaler, "n_features_in_", len(FEATURES)) != len(FEATURES):
            raise ModelNotReadyError(
                f"Scaler expects {getattr(scaler, 'n_features_in_', '?')} features but the "
                f"configuration declares {len(FEATURES)}. Re-run training."
            )

        _model, _scaler, _metrics = model, scaler, metrics
        _loaded_at = metrics.get("trained_at")
        return metrics


def get_artifacts() -> tuple[object, object, dict]:
    """Return ``(model, scaler, metrics)``, loading them on first use."""
    if _model is None:
        load_artifacts()
    if _model is None or _scaler is None or _metrics is None:  # pragma: no cover
        raise ModelNotReadyError("Model artifacts are unavailable.")
    return _model, _scaler, _metrics


def is_ready() -> bool:
    """True when a trained model is loaded and usable."""
    return _model is not None and _scaler is not None and _metrics is not None


def status() -> dict:
    """Model readiness, for ``GET /api/health``. Never raises."""
    ready = is_ready()
    return {
        "ready": ready,
        "algorithm": "RandomForestClassifier",
        "trained_at": _loaded_at,
        "features": len(FEATURES),
        "metrics_available": bool(_metrics),
    }


def get_metrics() -> dict:
    return get_artifacts()[2]


def headline_scores(metrics: dict) -> dict[str, float | None]:
    """
    The four top-level scores (accuracy / precision / recall / F1).

    ``train.py`` persists them under a nested ``metrics`` key, but older
    artifacts in the wild stored them at the top level. Reading only one of the
    two shapes is how ``/api/model/metrics`` ends up reporting ``accuracy:
    None`` while the training log printed a real number - so try both.
    """
    nested = metrics.get("metrics")
    source = nested if isinstance(nested, dict) and nested else metrics
    return {key: source.get(key) for key in ("accuracy", "precision", "recall", "f1_score")}


# --------------------------------------------------------------------------- #
# Preprocessing + validation
# --------------------------------------------------------------------------- #
def _medians(metrics: dict) -> dict[str, float]:
    medians = metrics.get("training_medians") or {}
    if not medians:
        # Older artifacts: fall back to the median recorded in dataset_stats.
        medians = {
            k: v["median"]
            for k, v in (metrics.get("dataset_stats") or {}).items()
            if isinstance(v, dict) and "median" in v
        }
    return medians


def _stats(metrics: dict) -> tuple[np.ndarray, np.ndarray]:
    """Per-feature training mean and standard deviation."""
    stats = metrics.get("dataset_stats") or {}
    mean = np.array([float(stats.get(f, {}).get("mean", 0.0)) for f in FEATURES])
    std = np.array([float(stats.get(f, {}).get("std", 1.0)) or 1.0 for f in FEATURES])
    return mean, std


def _coerce_row(
    raw: Mapping[str, object],
    medians: dict[str, float],
    strict: bool = True,
) -> tuple[np.ndarray, list[dict], list[str]]:
    """
    Validate + impute one reading into a model-ready vector.

    Returns ``(row, errors, imputed)`` where ``imputed`` lists the features that
    were not supplied (or unusable in non-strict mode) and therefore took the
    training median — so the API can be honest about what it substituted.
    """
    errors: list[dict] = []
    imputed: list[str] = []
    values: list[float] = []

    for name in FEATURES:
        meta = FEATURE_BY_NAME[name]
        value = raw.get(name)

        if value is None or (isinstance(value, str) and not value.strip()):
            # Missing reading -> training median (same rule as training).
            imputed.append(name)
            values.append(float(medians.get(name, 0.0)))
            continue

        try:
            number = float(value)
        except (TypeError, ValueError):
            if strict:
                errors.append(
                    {
                        "feature": name,
                        "label": meta.label,
                        "message": f"{meta.label} must be a number.",
                        "value": str(value),
                    }
                )
                imputed.append(name)
                values.append(float(medians.get(name, 0.0)))
                continue
            imputed.append(name)
            values.append(float("nan"))
            continue

        if not math.isfinite(number):
            if strict:
                errors.append(
                    {
                        "feature": name,
                        "label": meta.label,
                        "message": f"{meta.label} must be a finite number.",
                        "value": str(value),
                    }
                )
                imputed.append(name)
                number = float(medians.get(name, 0.0))
            else:
                imputed.append(name)
                number = float("nan")

        if strict and not (meta.min <= number <= meta.max):
            errors.append(
                {
                    "feature": name,
                    "label": meta.label,
                    "message": f"{meta.label} must be between {meta.min:g} and {meta.max:g} {meta.unit}.",
                    "value": number,
                    "min": meta.min,
                    "max": meta.max,
                }
            )
            number = min(max(number, meta.min), meta.max)

        values.append(number)

    return np.asarray(values, dtype=float), errors, imputed


def _impute_nan(row: np.ndarray, medians: dict[str, float]) -> np.ndarray:
    """Replace NaN with training medians (batch path)."""
    defaults = np.array([float(medians.get(f, 0.0)) for f in FEATURES])
    return np.where(np.isfinite(row), row, defaults)


# --------------------------------------------------------------------------- #
# Result assembly
# --------------------------------------------------------------------------- #
def _contributions(
    row: np.ndarray,
    importances: Mapping[str, float],
    mean: np.ndarray,
    std: np.ndarray,
) -> list[dict]:
    """
    Estimate how each feature pushed *this* reading up or down.

    ``contribution = importance × z`` where ``z`` is how many standard
    deviations the reading sits from the training average. Signs are meaningful
    (positive = pushed toward worse air quality); magnitudes are an estimate,
    not an exact Shapley decomposition.
    """
    z = (row - mean) / std
    raw = np.array([float(importances.get(f, 0.0)) * float(zi) for f, zi in zip(FEATURES, z)])
    total = float(np.abs(raw).sum())

    items = []
    for name, value, avg, dev, zi, contribution in zip(FEATURES, row, mean, std, z, raw):
        share = abs(contribution) / total * 100 if total > 0 else 0.0
        items.append(
            {
                "feature": name,
                "label": FEATURE_BY_NAME[name].label,
                "unit": FEATURE_BY_NAME[name].unit,
                "value": round(float(value), 4),
                "dataset_average": round(float(avg), 4),
                "z_score": round(float(zi), 3),
                "direction": "above" if zi >= 0 else "below",
                "influence": round(share, 2),
                "pushed_toward": "worse" if contribution > 0 else "better",
            }
        )

    items.sort(key=lambda item: item["influence"], reverse=True)
    return items[:5]


def _build_result(
    row: np.ndarray,
    probabilities: np.ndarray,
    metrics: dict,
    imputed: list[str] | None = None,
) -> dict:
    class_id = int(np.argmax(probabilities))
    label = CLASS_LABELS[class_id]
    confidence = float(probabilities[class_id])

    mean, std = _stats(metrics)
    contributions = _contributions(row, metrics.get("feature_importances") or {}, mean, std)
    medians = metrics.get("training_medians") or {}

    warnings = [
        item for item in contributions if abs(item["z_score"]) >= 3
    ]

    return {
        "prediction": class_id,
        "label": label,
        "status": label,
        "color": CLASS_COLORS[class_id],
        "confidence": round(confidence * 100, 1),
        "recommendation": CLASS_RECOMMENDATIONS[class_id],
        "all_probabilities": {
            CLASS_LABELS[i]: round(float(p) * 100, 1) for i, p in zip(CLASS_ORDER, probabilities)
        },
        "top_features": [
            {"feature": c["feature"], "label": c["label"], "importance": c["influence"],
             "direction": c["direction"], "z_score": c["z_score"]}
            for c in contributions
        ],
        "contributions": contributions,
        "outliers": [
            {"feature": w["feature"], "label": w["label"], "value": w["value"],
             "dataset_average": w["dataset_average"]}
            for w in warnings
        ],
        "imputed": [
            {
                "feature": name,
                "label": FEATURE_BY_NAME[name].label,
                "unit": FEATURE_BY_NAME[name].unit,
                "median_used": medians.get(name),
            }
            for name in (imputed or [])
        ],
        "inputs": {f: round(float(v), 4) for f, v in zip(FEATURES, row)},
    }


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def predict(readings: Mapping[str, object], strict: bool = True) -> dict:
    """Predict air quality from a single set of readings."""
    _, _, metrics = get_artifacts()
    medians = _medians(metrics)

    row, errors, imputed = _coerce_row(readings, medians, strict=strict)
    if errors:
        raise PredictionError(
            "Some readings are outside the expected range.",
            errors,
        )

    probabilities, _ = predict_matrix(row.reshape(1, -1))
    return _build_result(row, probabilities[0], metrics, imputed)


def predict_matrix(rows: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Vectorised scoring shared by single and batch prediction."""
    model, scaler, _ = get_artifacts()
    probabilities = model.predict_proba(scaler.transform(rows))
    return probabilities, np.asarray(model.classes_).astype(int)


def predict_frame(
    df: pd.DataFrame,
    strict: bool = False,
) -> tuple[pd.DataFrame, dict]:
    """
    Predict a whole frame of readings.

    Returns ``(results_frame, summary)``. Bad cells never abort the job — they
    are replaced with the training median and reported separately:

    * ``imputed`` — a value was simply absent (blank, or the -200
      "sensor disconnected" sentinel). Recoverable, but worth flagging.
    * ``failed``  — a value was present but unusable (non-numeric text, or far
      outside the physically plausible range). Usually a data-entry mistake.

    ``strict=True`` raises instead, which is what the single-record path uses.
    """
    _, _, metrics = get_artifacts()
    medians = _medians(metrics)

    frame = df.copy()

    # Row-level flags, so each row is reported once rather than once per cell.
    missing_rows = pd.Series(False, index=frame.index)
    invalid_rows = pd.Series(False, index=frame.index)
    flagged_rows = pd.Series(False, index=frame.index)
    missing_cells = 0
    invalid_cells = 0

    for col in FEATURES:
        meta = FEATURE_BY_NAME[col]
        if col not in frame.columns:
            frame[col] = np.nan

        coerced = pd.to_numeric(frame[col], errors="coerce")

        # "not a finite number": covers NaN, +/-inf and anything text-ish.
        non_finite = ~np.isfinite(coerced.to_numpy(dtype="float64", na_value=np.nan))
        sentinel = coerced.eq(MISSING_SENTINEL)
        out_of_range = coerced.notna() & ((coerced < meta.min) | (coerced > meta.max))

        # A cell is *absent* only if nothing usable was supplied: blank, or the
        # -200 "sensor disconnected" sentinel. Text and out-of-range numbers
        # were supplied but unusable, so they count as invalid instead.
        absent = frame[col].isna() | sentinel
        unusable = (non_finite | out_of_range) & ~absent

        missing_cells += int(absent.sum())
        invalid_cells += int(unusable.sum())

        for mask, tracker in ((absent, missing_rows), (unusable, invalid_rows)):
            newly_bad = mask & ~tracker
            if not newly_bad.any():
                continue
            tracker[mask] = True
            if strict:
                raise PredictionError(
                    f"Column '{col}' contains values outside {meta.min:g}-{meta.max:g} {meta.unit}.",
                    [
                        {
                            "feature": col,
                            "label": meta.label,
                            "message": f"{meta.label} must be between {meta.min:g} and {meta.max:g} {meta.unit}.",
                            "min": meta.min,
                            "max": meta.max,
                        }
                    ],
                )

        flagged_rows |= absent | unusable
        frame[col] = coerced.mask(absent | unusable)

    matrix = _impute_nan(frame[FEATURES].to_numpy(dtype=float), medians)

    probabilities, model_classes = predict_matrix(matrix)
    class_positions = np.argmax(probabilities, axis=1)
    class_ids = model_classes[class_positions]
    confidences = probabilities[np.arange(len(class_ids)), class_positions]

    results = pd.DataFrame(
        {
            "AQ_Category": class_ids,
            "Air_Quality": [CLASS_LABELS[c] for c in class_ids],
            "Confidence": np.round(confidences * 100, 1),
        },
        index=df.index,
    )
    for column, cls in enumerate(model_classes):
        results[f"Prob_{CLASS_LABELS[int(cls)]}"] = np.round(probabilities[:, column] * 100, 1)

    flagged = flagged_rows.to_numpy()
    distribution = {CLASS_LABELS[c]: int((class_ids == c).sum()) for c in CLASS_ORDER}
    # 1-based CSV line numbers (row index + 2: header is line 1), each row once.
    problem_lines = sorted(int(idx) + 2 for idx in frame.index[flagged])
    summary = {
        "total": int(len(results)),
        # "clean" = every cell was usable as supplied.
        "successful": int((~flagged).sum()),
        "imputed": int(missing_rows.sum()),
        "failed": int(invalid_rows.sum()),
        "rows_with_warnings": int(flagged.sum()),
        "missing_cells": missing_cells,
        "invalid_cells": invalid_cells,
        "problem_rows": problem_lines[:50],
        "distribution": distribution,
        "mean_confidence": round(float(confidences.mean() * 100), 1) if len(confidences) else 0.0,
    }
    return results, summary


def feature_schema() -> list[dict]:
    """
    Field definitions for the prediction form, with real dataset values.

    Placeholders are the training medians and ``range`` shows the observed
    min/max actually present in ``AirQualityUCI`` — so a demo audience can enter
    numbers that genuinely resemble the training data.
    """
    metrics = get_metrics()
    stats = metrics.get("dataset_stats") or {}
    schema = []
    for meta in FEATURE_META:
        stats_row = stats.get(meta.name, {})
        schema.append(
            {
                **meta.as_dict(),
                "placeholder": stats_row.get("median", meta.placeholder),
                "observed_min": stats_row.get("min"),
                "observed_max": stats_row.get("max"),
                "observed_mean": stats_row.get("mean"),
                "observed_std": stats_row.get("std"),
            }
        )
    return schema


def validate_mapping(readings: Mapping[str, object]) -> None:
    """Raise :class:`PredictionError` if the mapping cannot be predicted."""
    predict(readings, strict=True)


__all__ = [
    "ModelNotReadyError",
    "PredictionError",
    "feature_schema",
    "get_artifacts",
    "get_metrics",
    "is_ready",
    "load_artifacts",
    "predict",
    "predict_frame",
    "status",
    "validate_mapping",
]
