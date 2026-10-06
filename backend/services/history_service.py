"""
Prediction history, persisted in SQLite.

Every successful manual prediction is stored here. The table keeps the JSON
blob of readings (unchanged schema from the original implementation) and the
service additionally stores the primary pollutant columns as real columns so
the history page can search and sort on them in SQL instead of in Python.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from backend.config import DB_PATH

# Columns extracted from the readings JSON so the history table can be queried.
# CO, NOx and NO2 are the three pollutants the label function is built on.
SUMMARY_COLUMNS = {
    "CO_GT": "CO(GT)",
    "NOX_GT": "NOx(GT)",
    "NO2_GT": "NO2(GT)",
    "TEMP": "T",
    "RH": "RH",
}

SORTABLE = {
    "created_at": "timestamp",
    "timestamp": "timestamp",
    "id": "id",
    "confidence": "confidence",
    "prediction": "prediction",
    "co": "CO_GT",
    "nox": "NOX_GT",
    "no2": "NO2_GT",
    "temperature": "TEMP",
    "rh": "RH",
}

@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create the table if needed. Safe to call on every startup."""
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                inputs TEXT NOT NULL,
                prediction INTEGER NOT NULL,
                label TEXT NOT NULL,
                confidence REAL NOT NULL,
                recommendation TEXT,
                CO_GT REAL,
                NOX_GT REAL,
                NO2_GT REAL,
                TEMP REAL,
                RH REAL
            )
            """
        )
        # Older databases predate the summary columns; add them in place.
        existing = {row["name"] for row in conn.execute("PRAGMA table_info(predictions)")}
        for column in SUMMARY_COLUMNS:
            if column not in existing:
                conn.execute(f"ALTER TABLE predictions ADD COLUMN {column} REAL")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp DESC)"
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_prediction(inputs: dict, result: dict) -> int:
    """Persist one prediction and return its row id."""
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO predictions
                (timestamp, inputs, prediction, label, confidence, recommendation,
                 CO_GT, NOX_GT, NO2_GT, TEMP, RH)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _now(),
                json.dumps(inputs),
                int(result["prediction"]),
                result["label"],
                float(result["confidence"]),
                result.get("recommendation"),
                *_summary_values(inputs),
            ),
        )
        return int(cursor.lastrowid)


def _summary_values(inputs: dict) -> tuple:
    return tuple(
        _as_float(inputs.get(source)) for source in SUMMARY_COLUMNS.values()
    )


def _as_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _row_to_item(row: sqlite3.Row) -> dict:
    data = dict(row)
    try:
        parsed = json.loads(data.get("inputs") or "{}")
    except (TypeError, ValueError):
        parsed = {}
    return {
        "id": data["id"],
        # The original column is `timestamp`; expose it as created_at too.
        "created_at": data.get("timestamp"),
        "timestamp": data.get("timestamp"),
        "inputs": parsed,
        "prediction": data["prediction"],
        "label": data["label"],
        "confidence": data["confidence"],
        "recommendation": data.get("recommendation"),
    }


def get_history(
    limit: int = 50,
    offset: int = 0,
    search: str | None = None,
    label: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
) -> list[dict]:
    """Filtered, sorted, paginated history. Search matches label or a pollutant value."""
    # Whitelisted lookup - the raw `sort` value never reaches the SQL string.
    sort_column = SORTABLE.get(sort, "timestamp")
    direction = "ASC" if str(order).lower() == "asc" else "DESC"

    clauses: list[str] = []
    params: list[Any] = []

    if search:
        term = f"%{search.strip()}%"
        clauses.append(
            "(label LIKE ? OR inputs LIKE ? OR CAST(CO_GT AS TEXT) LIKE ?"
            " OR CAST(NOX_GT AS TEXT) LIKE ? OR CAST(NO2_GT AS TEXT) LIKE ?)"
        )
        params.extend([term] * 5)
    if label:
        clauses.append("label = ?")
        params.append(label)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = (
        f"SELECT * FROM predictions {where} "
        f"ORDER BY {sort_column} {direction}, id {direction} LIMIT ? OFFSET ?"
    )
    params.extend([int(limit), int(offset)])

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_row_to_item(row) for row in rows]


def get_history_count(
    search: str | None = None,
    label: str | None = None,
) -> int:
    clauses: list[str] = []
    params: list[Any] = []
    if search:
        term = f"%{search.strip()}%"
        clauses.append(
            "(label LIKE ? OR inputs LIKE ? OR CAST(CO_GT AS TEXT) LIKE ?"
            " OR CAST(NOX_GT AS TEXT) LIKE ? OR CAST(NO2_GT AS TEXT) LIKE ?)"
        )
        params.extend([term] * 5)
    if label:
        clauses.append("label = ?")
        params.append(label)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with get_conn() as conn:
        return int(conn.execute(f"SELECT COUNT(*) FROM predictions {where}", params).fetchone()[0])


def get_recent(limit: int = 5) -> list[dict]:
    return get_history(limit=limit)


def get_statistics() -> dict:
    """Aggregate stats for the dashboard. Returns zeros for an empty table."""
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS total,
                   AVG(confidence) AS avg_confidence,
                   COUNT(DISTINCT label) AS categories
            FROM predictions
            """
        ).fetchone()
        distribution = {
            r["label"]: r["n"]
            for r in conn.execute(
                "SELECT label, COUNT(*) AS n FROM predictions GROUP BY label"
            ).fetchall()
        }
    total = int(row["total"] or 0)
    return {
        "total": total,
        "mean_confidence": round(float(row["avg_confidence"]), 1) if row["avg_confidence"] else 0.0,
        "categories_used": int(row["categories"] or 0),
        "distribution": distribution,
    }


def delete_prediction(pred_id: int) -> bool:
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM predictions WHERE id = ?", (pred_id,))
        return cursor.rowcount > 0


def clear_history() -> int:
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM predictions")
        return int(cursor.rowcount)


__all__ = [
    "clear_history",
    "delete_prediction",
    "get_history",
    "get_history_count",
    "get_recent",
    "get_statistics",
    "init_db",
    "save_prediction",
]
