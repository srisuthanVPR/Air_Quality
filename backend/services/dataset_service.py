"""
Dataset access for the dashboard, the Dataset Explorer and the Analytics page.

The full CSV is read once and cached in memory (9.5k rows x 15 columns is a few
MB), and every response is a *slice* of that frame. The browser never receives
the whole dataset — it asks for one page of rows at a time.

All numbers returned here are computed from the real file. Nothing is
hard-coded, and a field that cannot be computed is returned as ``None`` so the
UI renders "Not available" rather than inventing a value.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd

from backend.ml.config import (
    CLASS_COLORS,
    CLASS_LABELS,
    CLASS_ORDER,
    EXCLUDED_COLUMNS,
    FEATURES,
)
from backend.ml.preprocess import add_datetime, clean_frame, read_csv
from backend.utils.serialize import to_json_safe

# Columns offered by the Dataset Explorer, in display order.
EXPLORE_COLUMNS = ["Date", "Time", "DateTime"] + FEATURES + ["NMHC(GT)"]
NUMERIC_COLUMNS = FEATURES + ["NMHC(GT)"]
CATEGORICAL_COLUMNS = ["Date", "Time"]

# Parameters offered in the Analytics parameter picker.
ANALYTICS_METRICS = [
    {"key": "CO(GT)", "label": "Carbon Monoxide", "unit": "mg/m³", "group": "pollutant"},
    {"key": "NOx(GT)", "label": "Nitrogen Oxides", "unit": "ppb", "group": "pollutant"},
    {"key": "NO2(GT)", "label": "Nitrogen Dioxide", "unit": "µg/m³", "group": "pollutant"},
    {"key": "C6H6(GT)", "label": "Benzene", "unit": "µg/m³", "group": "pollutant"},
    {"key": "NMHC(GT)", "label": "NMHC", "unit": "µg/m³", "group": "pollutant"},
    {"key": "PT08.S1(CO)", "label": "CO sensor", "unit": "signal", "group": "sensor"},
    {"key": "PT08.S2(NMHC)", "label": "NMHC sensor", "unit": "signal", "group": "sensor"},
    {"key": "PT08.S3(NOx)", "label": "NOx sensor", "unit": "signal", "group": "sensor"},
    {"key": "PT08.S4(NO2)", "label": "NO2 sensor", "unit": "signal", "group": "sensor"},
    {"key": "PT08.S5(O3)", "label": "Ozone sensor", "unit": "signal", "group": "sensor"},
    {"key": "T", "label": "Temperature", "unit": "°C", "group": "meteorology"},
    {"key": "RH", "label": "Relative Humidity", "unit": "%", "group": "meteorology"},
    {"key": "AH", "label": "Absolute Humidity", "unit": "g/m³", "group": "meteorology"},
]
METRIC_UNITS = {m["key"]: m["unit"] for m in ANALYTICS_METRICS}

# Correlation is computed over the cleaned feature matrix.
CORRELATION_COLUMNS = FEATURES


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def load_dataset() -> pd.DataFrame:
    """Raw dataset with ``DateTime`` parsed, cached for the process lifetime."""
    return add_datetime(read_csv())


@lru_cache(maxsize=1)
def load_clean() -> pd.DataFrame:
    """Cleaned (blank rows dropped, gaps imputed) dataset — what the model saw."""
    return clean_frame(load_dataset())


def dataset_available() -> bool:
    try:
        load_dataset()
        return True
    except Exception:  # noqa: BLE001
        return False


def _clean(value: Any) -> Any:
    """JSON-safe conversion for values read out of the dataset frame."""
    return to_json_safe(value)


def _round_frame(df: pd.DataFrame, decimals: int = 4) -> pd.DataFrame:
    return df.round(decimals)


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #
def get_summary() -> dict:
    """Headline dataset statistics for the Dataset Explorer header."""
    raw = load_dataset()
    valid = load_clean()

    stats: dict[str, dict] = {}
    for col in NUMERIC_COLUMNS:
        if col not in raw.columns:
            continue
        series = pd.to_numeric(raw[col], errors="coerce")
        clean_series = series.dropna()
        stats[col] = {
            "count": int(clean_series.count()),
            "missing": int(series.isna().sum()),
            "mean": _clean(clean_series.mean()),
            "median": _clean(clean_series.median()),
            "std": _clean(clean_series.std()),
            "min": _clean(clean_series.min()),
            "max": _clean(clean_series.max()),
            "q1": _clean(clean_series.quantile(0.25)),
            "q3": _clean(clean_series.quantile(0.75)),
        }

    datetimes = pd.to_datetime(raw["DateTime"], errors="coerce").dropna()

    # ``DateTime`` is derived from Date + Time; report only real file columns.
    source_columns = [c for c in raw.columns if c != "DateTime"]

    columns = []
    for col in source_columns:
        dtype = str(raw[col].dtype)
        is_numeric = col in NUMERIC_COLUMNS or pd.api.types.is_numeric_dtype(raw[col])
        columns.append(
            {
                "name": col,
                "dtype": dtype,
                "kind": "numeric" if is_numeric else "categorical",
                "missing": int(raw[col].isna().sum()),
                "missing_pct": round(float(raw[col].isna().mean() * 100), 2),
                "unique": int(raw[col].nunique(dropna=True)),
                "is_feature": col in FEATURES,
                "excluded_reason": EXCLUDED_COLUMNS.get(col),
            }
        )

    return {
        "filename": "AirQualityUCI.csv",
        "total_rows": int(len(raw)),
        "valid_rows": int(len(valid)),
        "total_columns": int(len(source_columns)),
        "numeric_columns": len([c for c in columns if c["kind"] == "numeric"]),
        "categorical_columns": len([c for c in columns if c["kind"] != "numeric"]),
        "missing_values": int(raw[source_columns].isna().sum().sum()),
        "memory_bytes": int(raw[source_columns].memory_usage(deep=True).sum()),
        "feature_columns": FEATURES,
        "explore_columns": [c for c in EXPLORE_COLUMNS if c in raw.columns],
        "excluded_columns": EXCLUDED_COLUMNS,
        "stats": stats,
        "columns": columns,
        "date_range": {
            "start": _clean(datetimes.min()) if len(datetimes) else None,
            "end": _clean(datetimes.max()) if len(datetimes) else None,
            "days": int((datetimes.max() - datetimes.min()).days) if len(datetimes) else None,
        },
        "totals": {
            "total": int(len(raw)),
            "used_for_training": int(len(valid)),
            "blank_rows": int(len(raw) - len(valid)),
            "sentinel_rows": "Rows with every sensor reporting -200 are treated as blank and removed.",
        },
    }


# --------------------------------------------------------------------------- #
# Paginated rows for the Dataset Explorer
# --------------------------------------------------------------------------- #
def get_rows(
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    sort: str | None = None,
    order: str = "asc",
    columns: list[str] | None = None,
    missing_only: bool = False,
    feature_only: bool = False,
    start: str | None = None,
    end: str | None = None,
) -> dict:
    """
    One page of dataset rows, with search, sorting, column and missing filters.

    Filtering and sorting happen server-side so the browser only ever holds
    ``page_size`` rows.
    """
    df = load_dataset()

    available = [c for c in EXPLORE_COLUMNS if c in df.columns]
    selected = [c for c in (columns or available) if c in df.columns] or available

    frame = df[selected].copy()

    # Date filtering on the parsed timestamp.
    timestamps = pd.to_datetime(df["DateTime"], errors="coerce")
    if start:
        frame = frame[(timestamps >= pd.Timestamp(start)).to_numpy()]
        timestamps = timestamps[(timestamps >= pd.Timestamp(start)).to_numpy()]
    if end:
        frame = frame[(timestamps <= pd.Timestamp(end)).to_numpy()]

    if missing_only:
        mask = frame[[c for c in frame.columns if c in NUMERIC_COLUMNS]].isna().any(axis=1)
        frame = frame[mask.to_numpy()]

    if feature_only:
        frame = frame[[c for c in selected if c in FEATURES]]

    if search:
        term = str(search).strip().lower()
        if term:
            mask = np.zeros(len(frame), dtype=bool)
            for col in frame.columns:
                if col == "DateTime":
                    mask |= frame[col].astype(str).str.lower().str.contains(term, regex=False).to_numpy()
                elif frame[col].dtype == object or frame[col].dtype.name == "str":
                    mask |= frame[col].astype(str).str.lower().str.contains(term, regex=False).to_numpy()
                else:
                    mask |= (
                        frame[col]
                        .astype(str)
                        .str.lower()
                        .str.replace(r"\.0$", "", regex=True)
                        .str.contains(term, regex=False)
                        .to_numpy()
                    )
            frame = frame[mask]

    total = int(len(frame))

    if sort and sort in frame.columns:
        ascending = str(order).lower() == "asc"
        frame = frame.sort_values(
            by=sort, ascending=ascending, na_position="last", kind="mergesort"
        )
    else:
        ascending = str(order).lower() == "asc"

    start_index = max(0, (page - 1) * page_size)
    window = frame.iloc[start_index : start_index + page_size]

    rows = [{k: _clean(v) for k, v in record.items()} for record in window.to_dict(orient="records")]

    return {
        "rows": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, int(np.ceil(total / page_size))) if total else 0,
        "columns": list(window.columns),
        "sort": sort if sort in df.columns else None,
        "order": "asc" if ascending else "desc",
        "search": search,
    }


# --------------------------------------------------------------------------- #
# Correlation
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def get_correlation() -> dict:
    """Pearson correlation matrix over the 12 model features."""
    clean = load_clean()
    matrix = clean[CORRELATION_COLUMNS].astype(float).corr()
    return {
        "columns": CORRELATION_COLUMNS,
        "matrix": [[round(float(v), 4) for v in row] for row in matrix.to_numpy()],
    }


# --------------------------------------------------------------------------- #
# Dashboard
# --------------------------------------------------------------------------- #
def get_dashboard() -> dict:
    """KPIs for the dashboard, all computed from the dataset and history."""
    raw = load_dataset()
    valid = load_clean()

    averages = {}
    for col in ["CO(GT)", "NOx(GT)", "NO2(GT)", "C6H6(GT)", "T", "RH", "AH"]:
        if col in raw.columns:
            averages[col] = _clean(pd.to_numeric(raw[col], errors="coerce").mean())

    return {
        "total_records": int(len(raw)),
        "valid_records": int(len(valid)),
        "training_records": int(len(valid)),
        "averages": averages,
        # Flat aliases kept so the dashboard can read them without mapping.
        **{k: v for k, v in averages.items()},
        "date_range": get_summary()["date_range"],
    }


# --------------------------------------------------------------------------- #
# Analytics
# --------------------------------------------------------------------------- #
def get_analytics(
    metric: str | None = None,
    group_by: str = "hour",
    start: str | None = None,
    end: str | None = None,
) -> dict:
    """
    Chart-ready aggregates.

    ``metric``   single parameter to trend (default: the dataset mean of CO(GT))
    ``group_by`` ``hour`` | ``day`` | ``month`` | ``none``
    """
    df = add_datetime(load_clean())
    if start:
        df = df[df["DateTime"] >= pd.Timestamp(start)]
    if end:
        df = df[df["DateTime"] <= pd.Timestamp(end)]

    metric = metric if metric in df.columns else "CO(GT)"
    metric_meta = next((m for m in ANALYTICS_METRICS if m["key"] == metric), None)
    unit = METRIC_UNITS.get(metric, "")

    trends = get_time_series(df, metric, group_by)

    distributions = {}
    for col in ["CO(GT)", "NOx(GT)", "NO2(GT)", "C6H6(GT)", "T", "RH"]:
        if col in df.columns:
            distributions[col] = get_histogram(df[col], bins=24)

    return {
        "metric": metric,
        "metric_label": metric_meta["label"] if metric_meta else metric,
        "unit": unit,
        "group_by": group_by,
        "range": {
            "start": _clean(df["DateTime"].min()) if len(df) else None,
            "end": _clean(df["DateTime"].max()) if len(df) else None,
            "rows": int(len(df)),
        },
        "available_metrics": ANALYTICS_METRICS,
        "time_series": trends,
        "distributions": distributions,
        "correlation": get_correlation(),
        "scatter": get_scatter(df),
        "class_distribution": get_class_distribution(),
        "hourly_profile": get_time_series(df, metric, "hour"),
        "daily_profile": get_time_series(df, metric, "day"),
    }


def get_time_series(df: pd.DataFrame, metric: str, group_by: str) -> list[dict]:
    if not len(df):
        return []
    series = pd.to_numeric(df[metric], errors="coerce")

    if group_by == "hour":
        keys = df["DateTime"].dt.hour
    elif group_by == "day":
        keys = df["DateTime"].dt.day
    elif group_by == "month":
        keys = df["DateTime"].dt.to_period("M").astype(str)
    else:
        keys = pd.Series(np.zeros(len(df), dtype=int), index=df.index)

    grouped = series.groupby(keys).agg(["mean", "min", "max", "count"]).reset_index()
    grouped.columns = ["key", "mean", "min", "max", "count"]

    if group_by in {"hour", "month"}:
        grouped = grouped.sort_values("key")

    out = []
    for key, mean, minimum, maximum, count in grouped.itertuples(index=False, name=None):
        if group_by == "hour":
            label = f"{int(key):02d}:00"
        elif group_by == "none":
            label = "Average"
        else:
            label = str(key)
        out.append(
            {
                "label": label,
                "key": str(key),
                "mean": _clean(mean),
                "min": _clean(minimum),
                "max": _clean(maximum),
                "count": int(count),
            }
        )
    return out


def get_histogram(series: pd.Series, bins: int = 24) -> dict:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if not len(clean):
        return {"counts": [], "edges": [], "total": 0}
    counts, edges = np.histogram(clean, bins=bins)
    # Use bin centres so charts plot counts against a representative value.
    centres = (edges[:-1] + edges[1:]) / 2
    return {
        "counts": counts.tolist(),
        "edges": [round(float(e), 4) for e in edges.tolist()],
        "centres": [round(float(c), 4) for c in centres.tolist()],
        "total": int(len(clean)),
        "min": round(float(clean.min()), 4),
        "max": round(float(clean.max()), 4),
        "mean": round(float(clean.mean()), 4),
        "median": round(float(clean.median()), 4),
    }


def get_scatter(df: pd.DataFrame, limit: int = 600) -> dict:
    pairs = [
        {"x": "T", "y": "CO(GT)", "x_label": "Temperature", "y_label": "Carbon Monoxide",
         "x_unit": "°C", "y_unit": "mg/m³"},
        {"x": "T", "y": "NOx(GT)", "x_label": "Temperature", "y_label": "Nitrogen Oxides",
         "x_unit": "°C", "y_unit": "ppb"},
        {"x": "RH", "y": "NOx(GT)", "x_label": "Relative Humidity", "y_label": "Nitrogen Oxides",
         "x_unit": "%", "y_unit": "ppb"},
        {"x": "CO(GT)", "y": "NOx(GT)", "x_label": "Carbon Monoxide", "y_label": "Nitrogen Oxides",
         "x_unit": "mg/m³", "y_unit": "ppb"},
    ]

    out = []
    rng = np.random.default_rng(42)
    for pair in pairs:
        if pair["x"] not in df.columns or pair["y"] not in df.columns:
            continue
        sub = df[[pair["x"], pair["y"]]].dropna()
        if len(sub) > limit:
            sub = sub.iloc[rng.choice(len(sub), size=limit, replace=False)]
        out.append({**pair, "points": _round_frame(sub, 3).to_dict(orient="records")})

    # Temperature vs humidity coloured by the derived air-quality class.
    labelled = df[["T", "RH", "CO(GT)", "NOx(GT)", "NO2(GT)"]].dropna()
    if len(labelled) > limit:
        labelled = labelled.iloc[rng.choice(len(labelled), size=limit, replace=False)]
    from backend.ml.preprocess import create_target

    classes = create_target(labelled)
    out.append(
        {
            "x": "T",
            "y": "RH",
            "x_label": "Temperature",
            "y_label": "Relative Humidity",
            "x_unit": "°C",
            "y_unit": "%",
            "points": [
                {**_clean(point), "category": int(cls), "label": CLASS_LABELS[int(cls)]}
                for point, cls in zip(
                    _round_frame(labelled[["T", "RH"]], 3).to_dict(orient="records"), classes
                )
            ],
        }
    )
    return {"pairs": out}


def get_class_distribution() -> dict:
    """How the whole dataset splits across the four air-quality classes."""
    from backend.ml.preprocess import create_target

    classes = create_target(load_clean())
    counts = {CLASS_LABELS[c]: int((classes == c).sum()) for c in CLASS_ORDER}
    total = sum(counts.values()) or 1
    return {
        "counts": counts,
        "percentages": {k: round(v / total * 100, 2) for k, v in counts.items()},
        "colors": {CLASS_LABELS[c]: CLASS_COLORS[c] for c in CLASS_ORDER},
        "total": int(total),
    }


__all__ = [
    "ANALYTICS_METRICS",
    "CATEGORICAL_COLUMNS",
    "EXPLORE_COLUMNS",
    "METRIC_UNITS",
    "NUMERIC_COLUMNS",
    "dataset_available",
    "get_analytics",
    "get_class_distribution",
    "get_correlation",
    "get_dashboard",
    "get_histogram",
    "get_rows",
    "get_scatter",
    "get_summary",
    "get_time_series",
    "load_clean",
    "load_dataset",
]
