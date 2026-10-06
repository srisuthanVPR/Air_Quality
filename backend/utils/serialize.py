"""
JSON-safe serialisation for values coming out of pandas.

``NaN`` and ``NaT`` are valid in a pandas frame but *not* valid JSON — sending
them raises ``ValueError: Out of range float values are not JSON compliant``.
Every API response that echoes dataset values runs through
:func:`to_json_safe`, which converts them to ``None`` so the frontend renders
"missing" instead of crashing.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


def to_json_safe(value: Any, decimals: int = 4) -> Any:
    """Recursively convert numpy/pandas scalars and NaN into JSON-safe values."""
    if value is None or value is pd.NaT:
        return None

    if isinstance(value, (bool, np.bool_)):
        return bool(value)

    if isinstance(value, (int, np.integer)):
        return int(value)

    if isinstance(value, (float, np.floating)):
        number = float(value)
        return None if not math.isfinite(number) else round(number, decimals)

    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.isoformat()

    if isinstance(value, np.ndarray):
        return [to_json_safe(item, decimals) for item in value.tolist()]

    if isinstance(value, pd.Series):
        return [to_json_safe(item, decimals) for item in value.tolist()]

    if isinstance(value, dict):
        return {str(k): to_json_safe(v, decimals) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [to_json_safe(item, decimals) for item in value]

    if isinstance(value, str) or value is pd.NA:
        return None if value is pd.NA else value

    # Anything else: ask pandas whether it is missing before giving up.
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def frame_to_records(df: pd.DataFrame, decimals: int = 4, limit: int | None = None) -> list[dict]:
    """Convert a DataFrame slice into a list of JSON-safe row dictionaries."""
    frame = df.head(limit) if limit is not None else df
    return [to_json_safe(record, decimals) for record in frame.to_dict(orient="records")]


__all__ = ["frame_to_records", "to_json_safe"]
