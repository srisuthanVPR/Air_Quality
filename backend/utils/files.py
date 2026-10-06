"""Upload validation helpers.

Every file that reaches the prediction pipeline passes through
:func:`validate_upload`, which enforces the file type, the size limit and that
the payload is genuinely a CSV before pandas is allowed anywhere near it.
"""
from __future__ import annotations

import io
from pathlib import PurePosixPath

import pandas as pd

from backend.config import (
    ALLOWED_UPLOAD_CONTENT_TYPES,
    ALLOWED_UPLOAD_SUFFIXES,
    MAX_UPLOAD_BYTES,
)
from backend.ml.config import FEATURE_BY_NAME, FEATURES, MISSING_SENTINEL
from backend.utils.errors import bad_request

# Padded columns the AirQualityUCI format sometimes carries.
_COLUMN_ALIASES = {
    "co(gt)": "CO(GT)",
    "pt08.s1(co)": "PT08.S1(CO)",
    "c6h6(gt)": "C6H6(GT)",
    "pt08.s2(nmhc)": "PT08.S2(NMHC)",
    "nox(gt)": "NOx(GT)",
    "pt08.s3(nox)": "PT08.S3(NOx)",
    "no2(gt)": "NO2(GT)",
    "pt08.s4(no2)": "PT08.S4(NO2)",
    "pt08.s5(o3)": "PT08.S5(O3)",
    "t": "T",
    "rh": "RH",
    "ah": "AH",
}


def _extension(filename: str) -> str:
    return PurePosixPath(filename or "").suffix.lower()


def validate_upload(filename: str | None, content_type: str | None, payload: bytes) -> None:
    """Raise a user-facing :class:`APIError` if the upload is unacceptable."""
    name = filename or "upload"

    if not name.lower().endswith(tuple(ALLOWED_UPLOAD_SUFFIXES)):
        raise bad_request(
            "Only CSV files are accepted.",
            f"'{name}' is not a .csv file. Download the sample template and try again.",
        )

    if content_type and content_type.split(";")[0].strip().lower() not in ALLOWED_UPLOAD_CONTENT_TYPES:
        raise bad_request(
            "That file type is not supported.",
            "Please upload a plain .csv file exported from a spreadsheet.",
        )

    if not payload:
        raise bad_request(
            "The uploaded file is empty.",
            "Export your data as CSV with a header row and at least one record.",
        )

    if len(payload) > MAX_UPLOAD_BYTES:
        limit_mb = MAX_UPLOAD_BYTES / (1024 * 1024)
        raise bad_request(
            f"The uploaded file is larger than the {limit_mb:.0f} MB limit.",
            "Split the file into smaller chunks and upload them separately.",
        )

    # Reject binary content early: a valid CSV must be decodable text.
    try:
        payload[:4096].decode("utf-8")
    except UnicodeDecodeError:
        raise bad_request(
            "That file does not look like a text-based CSV.",
            "If it is an Excel file, export it as CSV first.",
        ) from None


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Trim whitespace and repair the odd casing variants Excel produces."""
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    renamed = {}
    for column in df.columns:
        key = column.lower().replace(" ", "")
        if column not in FEATURES and key in _COLUMN_ALIASES:
            renamed[column] = _COLUMN_ALIASES[key]
    return df.rename(columns=renamed) if renamed else df


def parse_csv(payload: bytes) -> pd.DataFrame:
    """
    Parse an uploaded CSV, picking the delimiter that actually matches the file.

    AirQualityUCI is ``;``-separated with a European decimal comma, while a file
    exported from Excel is usually ``,``-separated with ``.`` decimals. Rather
    than guessing, every dialect is parsed and scored by how many of the 12
    required feature columns it produces, and the best match wins.
    """
    common_na = ["", "NA", "N/A", "null", "None"]
    attempts = (
        # AirQualityUCI native dialect.
        {"sep": ";", "decimal": ",", "na_values": common_na + [MISSING_SENTINEL]},
        # Excel / pandas default export.
        {"sep": ",", "na_values": common_na + [MISSING_SENTINEL]},
        # Last resort: let pandas sniff, then fall back to comma.
        {"sep": None, "engine": "python", "na_values": common_na + [MISSING_SENTINEL]},
        {"sep": ",", "decimal": ".", "na_values": common_na},
    )

    best: tuple[int, pd.DataFrame] | None = None
    for kwargs in attempts:
        try:
            df = pd.read_csv(io.BytesIO(payload), **kwargs)
        except Exception:  # noqa: BLE001 - try the next dialect
            continue
        if not len(df.columns):
            continue

        df = _normalise_columns(df)
        df = df.loc[:, ~df.columns.str.match(r"^Unnamed\b")]
        if not len(df.columns):
            continue

        score = sum(1 for feature in FEATURES if feature in df.columns)
        if best is None or score > best[0]:
            best = (score, df)
        if score == len(FEATURES):
            break

    if best is None:
        raise bad_request(
            "That CSV file could not be read.",
            "Check that it is comma or semicolon separated and has a header row.",
        )

    return best[1]


def validate_columns(df: pd.DataFrame) -> list[str]:
    """Return the list of missing required columns (empty when the file is valid)."""
    return [f for f in FEATURES if f not in df.columns]


def missing_columns_error(missing: list[str]) -> Exception:
    """Build a precise 400 explaining exactly which columns to add."""
    readable = ", ".join(f"{f} ({FEATURE_BY_NAME[f].unit})" for f in missing)
    return bad_request(
        f"The CSV is missing {len(missing)} required column(s): {readable}.",
        "Download the sample CSV template — it already contains a correct header row.",
    )


__all__ = [
    "missing_columns_error",
    "parse_csv",
    "validate_columns",
    "validate_upload",
]
