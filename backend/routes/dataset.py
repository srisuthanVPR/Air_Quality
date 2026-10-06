"""Dataset endpoints: summary statistics, paginated rows, correlation, download."""
from __future__ import annotations

import io

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from backend.config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from backend.ml.config import FEATURES
from backend.services import dataset_service as ds

router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.get("/summary", summary="Dataset shape, column metadata and per-column statistics")
async def dataset_summary():
    return ds.get_summary()


@router.get(
    "/sample",
    summary="One page of dataset rows, with search / sort / column filters",
)
async def dataset_sample(
    page: int = Query(1, ge=1, description="1-based page number."),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    search: str | None = Query(None, description="Match against any visible column."),
    sort: str | None = Query(None, description="Column name to sort by."),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    columns: str | None = Query(
        None, description="Comma-separated column list. Defaults to all columns."
    ),
    missing_only: bool = Query(False, description="Only rows containing a missing value."),
    feature_only: bool = Query(False, description="Only the 12 model feature columns."),
    start: str | None = Query(None, description="Earliest timestamp, e.g. 2004-03-10."),
    end: str | None = Query(None, description="Latest timestamp, e.g. 2005-04-04."),
):
    try:
        return ds.get_rows(
            page=page,
            page_size=page_size,
            search=search,
            sort=sort,
            order=order,
            columns=[c.strip() for c in columns.split(",")] if columns else None,
            missing_only=missing_only,
            feature_only=feature_only,
            start=start,
            end=end,
        )
    except ValueError:
        # A malformed date reached the pandas parser.
        from backend.utils.errors import bad_request

        raise bad_request(
            "That date range could not be understood.",
            "Use ISO format, for example start=2004-03-10 and end=2005-04-04.",
        ) from None


@router.get("/correlation", summary="Pearson correlation matrix for the model features")
async def dataset_correlation():
    return ds.get_correlation()


@router.get("/download", summary="Download the full AirQualityUCI dataset", response_class=StreamingResponse)
async def download_dataset():
    buffer = io.StringIO()
    ds.load_dataset().to_csv(buffer, index=False)
    return StreamingResponse(
        io.BytesIO(buffer.getvalue().encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="AirQualityUCI.csv"'},
    )


@router.get("/feature-columns", summary="The columns the model was trained on")
async def feature_columns():
    return {
        "features": FEATURES,
        "count": len(FEATURES),
        "excluded": ds.get_summary()["excluded_columns"],
    }
