"""``POST /api/predict`` — single reading to air-quality prediction."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Query

from backend.ml.config import CLASS_COLORS, CLASS_LABELS, CLASS_ORDER
from backend.ml.predictor import PredictionError, predict
from backend.schemas import PredictRequest, PredictResponse
from backend.services.history_service import save_prediction
from backend.utils.errors import unprocessable

router = APIRouter(tags=["prediction"])


def _extract_readings(payload: Any) -> dict:
    """
    Accept either a flat mapping of readings or ``{"readings": {...}}``.

    Keeping both shapes means curl examples, the React app and any future
    mobile client can all use the simplest form that suits them.
    """
    if isinstance(payload, PredictRequest):
        return payload.readings
    if isinstance(payload, dict) and isinstance(payload.get("readings"), dict):
        return payload["readings"]
    if isinstance(payload, dict):
        return payload
    raise unprocessable(
        "Send the sensor readings as a JSON object, for example {\"CO(GT)\": 2.6, \"T\": 13.6}."
    )


@router.post(
    "/predict",
    response_model=PredictResponse,
    summary="Predict air quality from a single set of readings",
)
async def predict_endpoint(
    payload: PredictRequest | dict[str, Any] = Body(
        ...,
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
    ),
    save: bool = Query(True, description="Store the prediction in history."),
):
    readings = _extract_readings(payload)

    if not readings:
        raise unprocessable(
            "No readings were supplied.",
            "Provide at least one sensor value, e.g. {\"CO(GT)\": 2.6}.",
        )

    try:
        result = predict(readings, strict=True)
    except PredictionError:
        raise
    except (TypeError, ValueError) as exc:
        raise unprocessable(
            "The readings could not be interpreted.",
            "Every feature must be a number inside its accepted range.",
        ) from exc

    if save:
        result["history_id"] = save_prediction(result["inputs"], result)

    return result


@router.get("/predict/classes", tags=["prediction"], summary="The four air-quality classes")
async def list_classes():
    return {
        "classes": [
            {
                "id": cls,
                "label": CLASS_LABELS[cls],
                "color": CLASS_COLORS[cls],
            }
            for cls in CLASS_ORDER
        ]
    }
