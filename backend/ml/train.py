"""
Train and persist the air-quality classifier.

Run once (and again whenever the dataset or features change)::

    python -m backend.ml.train

Artifacts written to ``models/``:

* ``model.pkl``    — the fitted RandomForestClassifier
* ``scaler.pkl``   — the fitted StandardScaler (must match the model exactly)
* ``metrics.json`` — evaluation metrics, feature importances, training medians
                     and the baseline comparison used by the Model Performance
                     page

The model architecture, features and label function are unchanged from the
original implementation; this script adds the persisted metadata the API and
the web UI need so that nothing displayed has to be hard-coded or invented.
"""
from __future__ import annotations

import json
import platform
import sys
import warnings
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from backend.config import METRICS_PATH, MODEL_DIR, MODEL_PATH, SCALER_PATH
from backend.ml.config import (
    ALGORITHM,
    CLASS_LABELS,
    CLASS_ORDER,
    CLASS_RULE_TEXT,
    DATASET_NAME,
    FEATURES,
    FEATURE_META,
    MODEL_NAME,
    RANDOM_STATE,
    TEST_SIZE,
    TRAINING_PARAMS,
)
from backend.ml.preprocess import compute_medians, create_target, load_dataset

# Baselines are trained purely so the Model Performance page can show an honest
# comparison instead of quoting a single accuracy number in isolation.
BASELINES = (
    ("Logistic Regression", LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)),
    ("Decision Tree", DecisionTreeClassifier(random_state=RANDOM_STATE)),
    ("Random Forest (primary)", RandomForestClassifier(**TRAINING_PARAMS)),
    ("Majority Class (Dummy)", DummyClassifier(strategy="most_frequent")),
)


def _score(y_true, y_pred) -> dict:
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
    }


def _per_class_report(y_true, y_pred) -> list[dict]:
    report = classification_report(
        y_true, y_pred, labels=CLASS_ORDER, output_dict=True, zero_division=0
    )
    rows = []
    for cls in CLASS_ORDER:
        entry = report.get(str(cls), {})
        rows.append(
            {
                "class_id": cls,
                "label": CLASS_LABELS[cls],
                "precision": round(float(entry.get("precision", 0.0)), 4),
                "recall": round(float(entry.get("recall", 0.0)), 4),
                "f1_score": round(float(entry.get("f1-score", 0.0)), 4),
                "support": int(entry.get("support", 0)),
            }
        )
    return rows


def _confusion(y_true, y_pred) -> dict:
    matrix = confusion_matrix(y_true, y_pred, labels=CLASS_ORDER)
    total = int(matrix.sum())
    return {
        "labels": [CLASS_LABELS[c] for c in CLASS_ORDER],
        "matrix": matrix.tolist(),
        "normalized": [[round(v / total, 4) for v in row] for row in matrix.tolist()],
    }


def train(verbose: bool = True) -> dict:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------------- data --
    raw = load_dataset(clean=False)
    df = load_dataset(clean=True)
    y = create_target(df)
    X = df[FEATURES].to_numpy(dtype=float)

    medians = compute_medians(df)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    # -------------------------------------------------------- preprocessing --
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    # ----------------------------------------------------------- baselines ---
    # The baselines are informational only; sklearn emits a noisy OptimizeWarning
    # for LogisticRegression on some SciPy versions.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        comparison = []
        for name, estimator in BASELINES:
            estimator.fit(X_train_s, y_train)
            pred = estimator.predict(X_test_s)
            row = {"name": name, "algorithm": type(estimator).__name__}
            row.update(_score(y_test, pred))
            row["is_primary"] = row["algorithm"] == ALGORITHM
            comparison.append(row)

    # ------------------------------------------------------- primary model --
    model = RandomForestClassifier(**TRAINING_PARAMS)
    model.fit(X_train_s, y_train)
    y_pred = model.predict(X_test_s)

    # ------------------------------------------------------------- metrics --
    metrics = _score(y_test, y_pred)
    per_class = _per_class_report(y_test, y_pred)
    confusion = _confusion(y_test, y_pred)

    # Dataset-wide label distribution (all rows, not just the test split).
    full_labels = create_target(load_dataset(clean=True))
    class_distribution = {
        CLASS_LABELS[int(c)]: int(n) for c, n in zip(*np.unique(full_labels, return_counts=True))
    }

    numeric_stats = {}
    for col in FEATURES:
        series = df[col].astype(float)
        numeric_stats[col] = {
            "mean": round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
            "std": round(float(series.std()), 4),
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
            "missing": int(df[col].isna().sum()),
        }

    payload = {
        "schema_version": 2,
        "model": {
            "name": MODEL_NAME,
            "algorithm": ALGORITHM,
            "params": TRAINING_PARAMS,
            "dataset": DATASET_NAME,
            "n_features": len(FEATURES),
            "features": FEATURES,
            "target": "AQ_Category",
            "target_rule": CLASS_RULE_TEXT,
            "classes": {str(k): v for k, v in CLASS_LABELS.items()},
            "uses_scaler": True,
        },
        "features": [
            {
                **meta.as_dict(),
                # Real training median, so the artifact matches /api/model/features.
                "placeholder": numeric_stats[meta.name]["median"],
                "observed_min": numeric_stats[meta.name]["min"],
                "observed_max": numeric_stats[meta.name]["max"],
                "observed_mean": numeric_stats[meta.name]["mean"],
                "observed_std": numeric_stats[meta.name]["std"],
            }
            for meta in FEATURE_META
        ],
        "metrics": metrics,
        "per_class": per_class,
        "confusion_matrix": confusion["matrix"],
        "confusion_matrix_normalized": confusion["normalized"],
        "confusion_labels": confusion["labels"],
        "model_comparison": comparison,
        "feature_importances": {
            f: round(float(v), 6) for f, v in zip(FEATURES, model.feature_importances_)
        },
        "training_medians": {k: round(v, 6) for k, v in medians.items()},
        "scaler_mean": [round(float(v), 6) for v in scaler.mean_],
        "scaler_scale": [round(float(v), 6) for v in scaler.scale_],
        "split": {
            "train_samples": int(len(X_train)),
            "test_samples": int(len(X_test)),
            "total_samples": int(len(X)),
            "test_size": TEST_SIZE,
            "random_state": RANDOM_STATE,
            "stratified": True,
        },
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "total_samples": int(len(X)),
        "n_features": len(FEATURES),
        "dataset_stats": numeric_stats,
        "class_distribution": class_distribution,
        "dataset_rows_raw": int(len(raw)),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "environment": {
            "python": platform.python_version(),
            "sklearn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "platform": sys.platform,
        },
    }

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    METRICS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    if verbose:
        print(f"Rows used for training : {len(X)}  (of {len(raw)} in the raw file)")
        print(f"Train / test           : {len(X_train)} / {len(X_test)}")
        print(f"Accuracy               : {metrics['accuracy']:.4f}")
        print(f"Precision (weighted)   : {metrics['precision']:.4f}")
        print(f"Recall (weighted)      : {metrics['recall']:.4f}")
        print(f"F1 (weighted)          : {metrics['f1_score']:.4f}")
        print("\nBaseline comparison:")
        for row in comparison:
            marker = " <- primary" if row["is_primary"] else ""
            print(f"  {row['name']:<26} accuracy={row['accuracy']:.4f} f1={row['f1_score']:.4f}{marker}")
        print(f"\nSaved artifacts to {MODEL_DIR}")

    return payload


if __name__ == "__main__":
    train()
