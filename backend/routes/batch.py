"""
Batch prediction.

``POST /api/predict/batch`` validates and scores an uploaded CSV and returns a
JSON summary plus a bounded preview. The full result set is kept in a small
in-memory job store so ``GET /api/predict/batch/{job_id}/download`` can stream
it back as a file — the JSON response stays small even for a 20k-row upload.
"""
from __future__ import annotations

import io
import threading
import time
import uuid

import pandas as pd
from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import StreamingResponse

from backend.config import (
    BATCH_JOB_TTL_SECONDS,
    MAX_BATCH_PREVIEW_ROWS,
    MAX_BATCH_ROWS,
)
from backend.ml.config import CLASS_LABELS, CLASS_ORDER, FEATURES, FEATURE_BY_NAME
from backend.ml.preprocess import read_csv
from backend.ml.predictor import predict_frame
from backend.schemas import BatchSummaryResponse
from backend.utils.errors import bad_request, not_found
from backend.utils.files import (
    missing_columns_error,
    parse_csv,
    validate_columns,
    validate_upload,
)
from backend.utils.serialize import frame_to_records

router = APIRouter(tags=["prediction"])

# job_id -> (created_at, filename, csv_text)
_JOBS: dict[str, tuple[float, str, str]] = {}
_JOBS_LOCK = threading.Lock()
MAX_JOBS = 20


def _prune_jobs() -> None:
    now = time.time()
    expired = [k for k, (created, _, _) in _JOBS.items() if now - created > BATCH_JOB_TTL_SECONDS]
    for key in expired:
        _JOBS.pop(key, None)
    if len(_JOBS) > MAX_JOBS:
        for key in sorted(_JOBS, key=lambda k: _JOBS[k][0])[: len(_JOBS) - MAX_JOBS]:
            _JOBS.pop(key, None)


def _store_job(filename: str, csv_text: str) -> str:
    with _JOBS_LOCK:
        _prune_jobs()
        job_id = uuid.uuid4().hex[:16]
        _JOBS[job_id] = (time.time(), filename, csv_text)
    return job_id


def _to_csv(df: pd.DataFrame) -> str:
    # utf-8-sig so Excel opens the file with the right characters.
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()


def _sample_rows(df: pd.DataFrame, limit: int) -> list[dict]:
    """First ``limit`` rows as JSON-safe dictionaries (NaN -> null)."""
    return frame_to_records(df, decimals=4, limit=limit)


@router.post(
    "/predict/batch",
    tags=["prediction"],
    response_model=BatchSummaryResponse,
    summary="Predict air quality for every row of an uploaded CSV",
)
async def batch_predict(file: UploadFile = File(...)):
    payload = await file.read()
    validate_upload(file.filename, file.content_type, payload)

    df = parse_csv(payload)
    if df.empty:
        raise bad_request(
            "The CSV has a header row but no data rows.",
            "Add at least one record and upload the file again.",
        )

    missing = validate_columns(df)
    if missing:
        raise missing_columns_error(missing)

    if len(df) > MAX_BATCH_ROWS:
        raise bad_request(
            f"The file contains {len(df):,} rows, which is above the {MAX_BATCH_ROWS:,} row limit.",
            "Split the file into smaller chunks and upload them separately.",
        )

    # Only the model features are scored; extra columns such as Date or Time are
    # carried through untouched so the download keeps the user's context.
    keep = [c for c in df.columns if c in FEATURES]
    results, summary = predict_frame(df[keep])

    combined = pd.concat([df, results], axis=1)
    csv_text = _to_csv(combined)
    job_id = _store_job(file.filename or "predictions.csv", csv_text)

    preview = _sample_rows(combined, MAX_BATCH_PREVIEW_ROWS)

    return {
        "job_id": job_id,
        "filename": file.filename,
        "total": summary["total"],
        "successful": summary["successful"],
        "imputed": summary["imputed"],
        "failed": summary["failed"],
        "rows_with_warnings": summary["rows_with_warnings"],
        "missing_cells": summary["missing_cells"],
        "invalid_cells": summary["invalid_cells"],
        "problem_rows": summary["problem_rows"],
        "distribution": summary["distribution"],
        "mean_confidence": summary["mean_confidence"],
        "columns": list(combined.columns),
        "preview": preview,
        "download_url": f"/api/predict/batch/{job_id}/download",
    }


@router.get(
    "/predict/batch/{job_id}/download",
    tags=["prediction"],
    summary="Download the predicted CSV for a previous batch job",
    response_class=StreamingResponse,
)
async def download_batch(job_id: str):
    with _JOBS_LOCK:
        _prune_jobs()
        job = _JOBS.get(job_id)
    if job is None:
        raise not_found(
            "That batch result is no longer available.",
            "Run the batch prediction again to generate a fresh download.",
        )

    _, filename, csv_text = job
    stem = filename.rsplit(".", 1)[0] or "predictions"
    return StreamingResponse(
        io.BytesIO(csv_text.encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{stem}_predicted.csv"'},
    )


@router.get(
    "/predict/sample-csv",
    tags=["prediction"],
    summary="Download a ready-to-fill CSV template",
    response_class=StreamingResponse,
)
async def sample_csv(rows: int = Query(10, ge=1, le=200)):
    """
    A template containing the 12 required columns.

    Prefilled with real rows sampled from ``AirQualityUCI`` so the user can see
    the expected shape (and comma decimals) before uploading their own data.
    """
    template = pd.DataFrame(columns=FEATURES)
    try:
        source = read_csv().dropna(subset=FEATURES, how="all").head(rows)
        template = source[FEATURES].head(rows).reset_index(drop=True)
    except Exception:  # noqa: BLE001 - dataset is optional for the template
        pass

    csv_text = _to_csv(template)
    return StreamingResponse(
        io.BytesIO(csv_text.encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="sample_input.csv"'},
    )


@router.get("/predict/template-columns", tags=["prediction"], summary="Required CSV columns")
async def template_columns():
    return {
        "required_columns": FEATURES,
        "optional_columns": ["Date", "Time", "NMHC(GT)"],
        "columns": [
            {
                "name": meta.name,
                "label": meta.label,
                "unit": meta.unit,
                "min": meta.min,
                "max": meta.max,
                "decimals": meta.decimals,
            }
            for meta in (FEATURE_BY_NAME[f] for f in FEATURES)
        ],
        "classes": [CLASS_LABELS[c] for c in CLASS_ORDER],
        "notes": [
            "Comma separated, one header row, decimal point for fractions (2.6 not 2,6).",
            "Any extra columns such as Date or Time are ignored but preserved in the download.",
            "Blank or out-of-range cells are replaced with the training median and reported.",
        ],
    }
