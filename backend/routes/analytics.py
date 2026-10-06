"""Analytics endpoint: chart-ready aggregates for the Analytics page."""
from __future__ import annotations

from fastapi import APIRouter, Query

from backend.services import dataset_service as ds

router = APIRouter(tags=["analytics"])


@router.get(
    "/analytics",
    summary="Trends, distributions, correlation and scatter data",
)
async def analytics(
    metric: str | None = Query(
        None, description="Parameter to trend, e.g. 'NOx(GT)'. Defaults to CO(GT)."
    ),
    group_by: str = Query(
        "hour", pattern="^(hour|day|month|none)$", description="Time bucket for the trend."
    ),
    start: str | None = Query(None, description="Earliest timestamp, e.g. 2004-03-10."),
    end: str | None = Query(None, description="Latest timestamp, e.g. 2005-04-04."),
):
    try:
        return ds.get_analytics(metric=metric, group_by=group_by, start=start, end=end)
    except ValueError:
        from backend.utils.errors import bad_request

        raise bad_request(
            "That date range could not be understood.",
            "Use ISO format, for example start=2004-03-10 and end=2005-04-04.",
        ) from None
