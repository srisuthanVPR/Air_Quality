"""Prediction history endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Query

from backend.ml.config import CLASS_LABELS, CLASS_ORDER
from backend.services.history_service import (
    clear_history,
    delete_prediction,
    get_history,
    get_history_count,
    get_statistics,
)
from backend.utils.errors import not_found

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", summary="Paginated, searchable prediction history")
async def list_history(
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None, description="Match label or a pollutant value."),
    label: str | None = Query(None, description="Filter by predicted class."),
    sort: str = Query("created_at", description="created_at | confidence | co | nox | no2 | temperature"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
):
    return {
        "items": get_history(
            limit=limit, offset=offset, search=search, label=label, sort=sort, order=order
        ),
        "total": get_history_count(search=search, label=label),
        "limit": limit,
        "offset": offset,
        "statistics": get_statistics(),
    }


@router.delete("/{prediction_id}", summary="Delete a single history record")
async def delete_history_item(prediction_id: int):
    if not delete_prediction(prediction_id):
        raise not_found(
            "That prediction is no longer in the history.",
            "Refresh the page to see the current records.",
        )
    return {"deleted": True, "id": prediction_id}


@router.delete("", summary="Clear the entire prediction history")
async def clear_all_history():
    return {"cleared": clear_history()}


@router.get("/labels", summary="Distinct labels present in the history")
async def history_labels():
    return {
        "labels": [CLASS_LABELS[c] for c in CLASS_ORDER],
        "statistics": get_statistics(),
    }
