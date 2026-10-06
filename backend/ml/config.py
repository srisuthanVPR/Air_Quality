"""
Single source of truth for the machine-learning side of the project.

Before this module the 12-feature list was duplicated in four different places
(``train.py``, ``predictor.py``, ``services/dataset_service.py`` and
``routes/predict.py``). Every route, the training script and the web form now
derive their inputs from ``FEATURE_META`` defined here, which makes it
impossible for the prediction form to drift away from what the model was
actually trained on.

Ranges below are *validation* bounds: the observed minimum/maximum of
``AirQualityUCI`` expanded by ~20% and rounded to a human-friendly number. They
guard against typos (e.g. entering ``13,6`` as 136000) without rejecting any
plausible reading.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from backend.config import DATA_PATH, METRICS_PATH, MODEL_DIR, MODEL_PATH, SCALER_PATH

# --------------------------------------------------------------------------- #
# Features
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class FeatureMeta:
    """Everything the UI and the validation layer need about one model input."""

    name: str
    label: str
    unit: str
    group: Literal["pollutant", "sensor", "meteorology"]
    min: float
    max: float
    step: float
    tooltip: str
    decimals: int = 2
    placeholder: float | None = None
    aliases: tuple[str, ...] = field(default_factory=tuple)

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "label": self.label,
            "unit": self.unit,
            "group": self.group,
            "min": self.min,
            "max": self.max,
            "step": self.step,
            "decimals": self.decimals,
            "tooltip": self.tooltip,
            "placeholder": self.placeholder,
            "aliases": list(self.aliases),
        }


FEATURE_META: tuple[FeatureMeta, ...] = (
    FeatureMeta(
        name="CO(GT)",
        label="Carbon Monoxide",
        unit="mg/m³",
        group="pollutant",
        min=0.0,
        max=20.0,
        step=0.1,
        decimals=2,
        placeholder=2.0,
        tooltip=(
            "Reference-grade carbon monoxide concentration. The dominant driver "
            "of the air-quality score in this model."
        ),
    ),
    FeatureMeta(
        name="PT08.S1(CO)",
        label="CO Sensor (PT08.S1)",
        unit="sensor output",
        group="sensor",
        min=500.0,
        max=2500.0,
        step=1.0,
        decimals=0,
        placeholder=1100.0,
        tooltip=(
            "Tin-oxide (PT08) sensor response to carbon monoxide. Higher values "
            "indicate higher CO concentration."
        ),
    ),
    FeatureMeta(
        name="C6H6(GT)",
        label="Benzene",
        unit="µg/m³",
        group="pollutant",
        min=0.0,
        max=100.0,
        step=0.1,
        decimals=2,
        placeholder=9.0,
        tooltip="Benzene (C6H6) ground-truth concentration, a known carcinogen.",
    ),
    FeatureMeta(
        name="PT08.S2(NMHC)",
        label="NMHC Sensor (PT08.S2)",
        unit="sensor output",
        group="sensor",
        min=300.0,
        max=2600.0,
        step=1.0,
        decimals=0,
        placeholder=950.0,
        tooltip=(
            "Titania-based sensor sensitive to non-methane hydrocarbons "
            "(NMHC). A strong proxy for fuel vapour and traffic emissions."
        ),
    ),
    FeatureMeta(
        name="NOx(GT)",
        label="Nitrogen Oxides",
        unit="ppb",
        group="pollutant",
        min=0.0,
        max=2000.0,
        step=1.0,
        decimals=0,
        placeholder=200.0,
        tooltip=(
            "Total nitrogen oxides (NO + NO2) in parts per billion. Traffic is "
            "the main source; the single most important feature in the model."
        ),
    ),
    FeatureMeta(
        name="PT08.S3(NOx)",
        label="NOx Sensor (PT08.S3)",
        unit="sensor output",
        group="sensor",
        min=250.0,
        max=3000.0,
        step=1.0,
        decimals=0,
        placeholder=900.0,
        tooltip="Tungsten-oxide sensor response to nitrogen oxides.",
    ),
    FeatureMeta(
        name="NO2(GT)",
        label="Nitrogen Dioxide",
        unit="µg/m³",
        group="pollutant",
        min=0.0,
        max=450.0,
        step=1.0,
        decimals=0,
        placeholder=100.0,
        tooltip=(
            "Nitrogen dioxide ground-truth concentration. A respiratory "
            "irritant produced mainly by combustion engines."
        ),
    ),
    FeatureMeta(
        name="PT08.S4(NO2)",
        label="NO2 Sensor (PT08.S4)",
        unit="sensor output",
        group="sensor",
        min=450.0,
        max=3200.0,
        step=1.0,
        decimals=0,
        placeholder=1500.0,
        tooltip="Tungsten-oxide sensor response to nitrogen dioxide.",
    ),
    FeatureMeta(
        name="PT08.S5(O3)",
        label="Ozone Sensor (PT08.S5)",
        unit="sensor output",
        group="sensor",
        min=150.0,
        max=3000.0,
        step=1.0,
        decimals=0,
        placeholder=1000.0,
        tooltip=(
            "Indium-oxide sensor response to ground-level ozone (O3), a "
            "secondary pollutant formed by sunlight acting on NOx and VOCs."
        ),
    ),
    FeatureMeta(
        name="T",
        label="Temperature",
        unit="°C",
        group="meteorology",
        min=-20.0,
        max=60.0,
        step=0.1,
        decimals=1,
        placeholder=18.0,
        tooltip=(
            "Ambient air temperature in °C. Warm, still weather traps "
            "pollutants near the ground."
        ),
    ),
    FeatureMeta(
        name="RH",
        label="Relative Humidity",
        unit="%",
        group="meteorology",
        min=0.0,
        max=100.0,
        step=0.1,
        decimals=1,
        placeholder=50.0,
        tooltip=(
            "Relative humidity in percent. Humidity alters how sensor drift "
            "appears and helps drive photochemical ozone formation."
        ),
    ),
    FeatureMeta(
        name="AH",
        label="Absolute Humidity",
        unit="g/m³",
        group="meteorology",
        min=0.05,
        max=3.0,
        step=0.001,
        decimals=4,
        placeholder=1.0,
        tooltip=(
            "Absolute humidity — the actual mass of water vapour per cubic "
            "metre of air."
        ),
    ),
)

FEATURES: list[str] = [f.name for f in FEATURE_META]
FEATURE_BY_NAME: dict[str, FeatureMeta] = {f.name: f for f in FEATURE_META}

GROUP_LABELS: dict[str, str] = {
    "pollutant": "Pollutant concentration (reference sensors)",
    "sensor": "Sensor response (PT08 array)",
    "meteorology": "Meteorological conditions",
}

# Columns present in AirQualityUCI.csv that are deliberately NOT model inputs.
# Surfaced in the UI so the Dataset Explorer and the form can explain the gap.
EXCLUDED_COLUMNS: dict[str, str] = {
    "NMHC(GT)": "Reference NMHC reading — collinear with PT08.S2(NMHC), excluded during feature selection.",
    "Date": "Calendar date of the reading — not a sensor measurement.",
    "Time": "Clock time of the reading — not a sensor measurement.",
}

# --------------------------------------------------------------------------- #
# Target classes
# --------------------------------------------------------------------------- #

CLASS_LABELS: dict[int, str] = {
    0: "Good",
    1: "Moderate",
    2: "Unhealthy",
    3: "Very Unhealthy",
}
CLASS_ORDER: list[int] = [0, 1, 2, 3]

CLASS_COLORS: dict[int, str] = {
    0: "#10b981",  # emerald-500
    1: "#f59e0b",  # amber-500
    2: "#f97316",  # orange-500
    3: "#ef4444",  # red-500
}

CLASS_RECOMMENDATIONS: dict[int, str] = {
    0: (
        "Air quality is good. Outdoor activities are fine for everyone — a "
        "good moment for jogging, cycling or an open window."
    ),
    1: (
        "Air quality is moderate. Most people can stay outside normally, but "
        "sensitive individuals (asthma, heart or lung conditions) should "
        "reduce prolonged or strenuous outdoor activity."
    ),
    2: (
        "Air quality is unhealthy. Everyone should reduce prolonged outdoor "
        "exertion; children, older adults and people with existing heart or "
        "lung disease should stay indoors and keep windows closed."
    ),
    3: (
        "Air quality is very unhealthy. Avoid outdoor activity altogether. "
        "Stay indoors with windows shut, and consider a well-fitting "
        "particulate respirator if you must go out."
    ),
}

CLASS_AUDIENCE: dict[int, str] = {
    0: "Everyone",
    1: "Sensitive groups",
    2: "Sensitive groups + athletes",
    3: "Everyone",
}

# How each class is derived from pollutant load. This mirrors ``create_target``
# in train.py and is exposed by the API so the UI can explain the label
# function instead of leaving a black box.
CLASS_RULE_TEXT: str = (
    "Each hourly reading is scored from CO(GT), NOx(GT) and NO2(GT). "
    "CO: >1 → +1, >2.5 → +2, >5 → +3. "
    "NOx: >50 → +1, >150 → +2, >300 → +3. "
    "NO2: >80 → +1, >150 → +2. "
    "Score ≥6 Very Unhealthy · ≥4 Unhealthy · ≥2 Moderate · else Good."
)

# --------------------------------------------------------------------------- #
# Model metadata
# --------------------------------------------------------------------------- #

MODEL_NAME = "Air Quality Classifier"
ALGORITHM = "RandomForestClassifier"
ALGORITHM_LABEL = "Random Forest Classifier"
DATASET_NAME = "AirQualityUCI"
TRAINING_PARAMS = {
    "n_estimators": 100,
    "random_state": 42,
    "n_jobs": -1,
}
TEST_SIZE = 0.2
RANDOM_STATE = 42

MODEL_DESCRIPTION = (
    "A Random Forest ensemble trained on the UCI Air Quality dataset. "
    "It reads 12 pollutant, sensor and meteorological values and returns an "
    "air-quality category — Good, Moderate, Unhealthy or Very Unhealthy — "
    "together with the model's probability for each category."
)

HOW_IT_WORKS = [
    {
        "title": "Raw sensor readings",
        "body": (
            "Every hour, five metal-oxide sensors plus reference instruments "
            "record CO, benzene, NOx and NO2, alongside temperature and "
            "humidity."
        ),
    },
    {
        "title": "Data cleaning",
        "body": (
            "The dataset uses -200 as a 'sensor disconnected' sentinel and "
            "contains 114 fully blank rows. These are removed rather than "
            "treated as real readings."
        ),
    },
    {
        "title": "Missing value handling",
        "body": (
            "Any feature still missing after cleaning is replaced with that "
            "column's median, so outlier readings cannot drag the average."
        ),
    },
    {
        "title": "Feature selection",
        "body": (
            "12 of the 15 available columns are kept. Date, Time and the "
            "collinear NMHC(GT) column are dropped."
        ),
    },
    {
        "title": "Preprocessing",
        "body": (
            "A StandardScaler centres and scales each feature. The same fitted "
            "scaler is saved and reused at prediction time."
        ),
    },
    {
        "title": "Train / test split",
        "body": (
            "80% training, 20% testing, stratified so every air-quality class "
            "keeps its share in both halves."
        ),
    },
    {
        "title": "Model training",
        "body": (
            "100 decision trees vote on the answer. Each tree sees a random "
            "sample of rows and features, which limits overfitting."
        ),
    },
    {
        "title": "Model evaluation",
        "body": (
            "Accuracy, precision, recall, F1 and a confusion matrix are "
            "computed on the held-out 20% and compared against baseline "
            "models."
        ),
    },
    {
        "title": "Prediction",
        "body": (
            "Your readings go through the identical scaler and model. The "
            "winning class plus its probability becomes your result."
        ),
    },
    {
        "title": "Air quality result",
        "body": (
            "The prediction is shown with a status colour, confidence, the "
            "factors that drove it and practical health advice."
        ),
    },
]

WORKFLOW_STEPS: list[str] = [
    "Raw Dataset",
    "Data Cleaning",
    "Missing Value Handling",
    "Feature Selection",
    "Data Preprocessing",
    "Train/Test Split",
    "ML Model Training",
    "Model Evaluation",
    "Prediction",
    "Air Quality Result",
]

# Sentinel value used by AirQualityUCI to mark a disconnected sensor.
MISSING_SENTINEL = -200

__all__ = [
    "ALGORITHM",
    "ALGORITHM_LABEL",
    "CLASS_AUDIENCE",
    "CLASS_COLORS",
    "CLASS_LABELS",
    "CLASS_ORDER",
    "CLASS_RECOMMENDATIONS",
    "CLASS_RULE_TEXT",
    "DATA_PATH",
    "EXCLUDED_COLUMNS",
    "FEATURES",
    "FEATURE_BY_NAME",
    "FEATURE_META",
    "GROUP_LABELS",
    "HOW_IT_WORKS",
    "METRICS_PATH",
    "MISSING_SENTINEL",
    "MODEL_DESCRIPTION",
    "MODEL_DIR",
    "MODEL_NAME",
    "MODEL_PATH",
    "RANDOM_STATE",
    "SCALER_PATH",
    "TEST_SIZE",
    "TRAINING_PARAMS",
    "WORKFLOW_STEPS",
]
