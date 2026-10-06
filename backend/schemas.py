"""Pydantic v2 request/response schemas for the public API."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Envelopes
# --------------------------------------------------------------------------- #
class ErrorDetail(BaseModel):
    code: str = Field(..., examples=["validation_error"])
    message: str = Field(..., examples=["Some readings are outside the expected range."])
    hint: str | None = Field(None, examples=["Check the highlighted fields and try again."])
    fields: list[dict[str, Any]] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorDetail


# --------------------------------------------------------------------------- #
# Prediction
# --------------------------------------------------------------------------- #
class PredictRequest(BaseModel):
    """
    A single set of sensor readings keyed by the real ``AirQualityUCI`` column
    names, e.g. ``{"CO(GT)": 2.6, "T": 13.6, ...}``.

    Declared as a free-form mapping on purpose: the allowed keys, units and
    ranges are owned by ``backend.ml.config.FEATURE_META`` and enforced there,
    so adding a feature never means editing the schema here.
    """

    model_config = ConfigDict(extra="ignore")

    readings: dict[str, float] = Field(
        ...,
        description="Mapping of feature name to numeric reading.",
        examples=[
            {
                "CO(GT)": 2.6,
                "PT08.S1(CO)": 1360,
                "C6H6(GT)": 11.9,
                "PT08.S2(NMHC)": 1046,
                "NOx(GT)": 166,
                "PT08.S3(NOx)": 1056,
                "NO2(GT)": 113,
                "PT08.S4(NO2)": 1692,
                "PT08.S5(O3)": 1268,
                "T": 13.6,
                "RH": 48.9,
                "AH": 0.7578,
            }
        ],
    )


class Contribution(BaseModel):
    feature: str
    label: str
    unit: str
    value: float
    dataset_average: float
    z_score: float
    direction: str
    influence: float
    pushed_toward: str


class ImputedFeature(BaseModel):
    feature: str
    label: str
    unit: str
    median_used: float | None = Field(None, description="Training median that was substituted.")


class PredictResponse(BaseModel):
    prediction: int = Field(..., examples=[2])
    label: str = Field(..., examples=["Unhealthy"])
    status: str = Field(..., examples=["Unhealthy"])
    color: str = Field(..., examples=["#f97316"])
    confidence: float = Field(..., examples=[100.0])
    recommendation: str
    all_probabilities: dict[str, float]
    contributions: list[Contribution]
    outliers: list[dict[str, Any]]
    imputed: list[ImputedFeature] = Field(
        default_factory=list,
        description="Features that were blank or unusable and took the training median.",
    )
    inputs: dict[str, float]
    history_id: int | None = Field(
        None, description="Row id in prediction history, when the prediction was stored."
    )


class BatchSummaryResponse(BaseModel):
    job_id: str
    filename: str | None = None
    total: int
    successful: int = Field(..., description="Rows where every value was usable as supplied.")
    imputed: int = Field(0, description="Rows where a value was blank/-200 and the median was used.")
    failed: int = Field(0, description="Rows containing an unusable value (text or out of range).")
    rows_with_warnings: int = 0
    missing_cells: int = 0
    invalid_cells: int = 0
    problem_rows: list[int] = Field(default_factory=list)
    distribution: dict[str, int]
    mean_confidence: float
    columns: list[str]
    preview: list[dict[str, Any]]
    download_url: str


# --------------------------------------------------------------------------- #
# Dataset
# --------------------------------------------------------------------------- #
class DatasetRow(BaseModel):
    model_config = ConfigDict(extra="allow")


class DatasetSampleResponse(BaseModel):
    rows: list[dict[str, Any]]
    total: int
    page: int
    page_size: int
    total_pages: int
    columns: list[str]
    sort: str | None = None
    order: str = "asc"
    search: str | None = None


# --------------------------------------------------------------------------- #
# History
# --------------------------------------------------------------------------- #
class HistoryItem(BaseModel):
    id: int
    created_at: str
    label: str
    prediction: int
    confidence: float
    recommendation: str | None = None
    inputs: dict[str, float] = Field(default_factory=dict)


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
    total: int
    limit: int
    offset: int


__all__ = [
    "BatchSummaryResponse",
    "Contribution",
    "DatasetSampleResponse",
    "ErrorDetail",
    "ErrorResponse",
    "HistoryItem",
    "HistoryResponse",
    "PredictRequest",
    "PredictResponse",
]
