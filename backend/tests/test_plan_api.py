from copy import deepcopy
from pathlib import Path
from typing import Any

import json
import pytest
from jsonschema import validate
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


@pytest.fixture
def valid_payload() -> dict[str, Any]:
    """Baseline valid request payload used by all API tests."""
    return {
        "timezone": "Europe/Belgrade",
        "week_start_date": "2026-03-30",
        "daily_hours": {
            "monday": 2,
            "tuesday": 2,
            "wednesday": 2,
            "thursday": 2,
            "friday": 2,
            "saturday": 2,
            "sunday": 2,
        },
        "subjects": [
            {"name": "Algorithms", "importance": 5},
            {"name": "Databases", "importance": 4},
        ],
        "tasks": [
            {
                "subject": "Algorithms",
                "title": "Midterm prep",
                "topic": "Graphs + DP",
                "due_date": "2026-04-03",
                "estimated_total_minutes": 180,
                "task_type": "exam",
            },
            {
                "subject": "Databases",
                "title": "Assignment 2",
                "topic": "Normalization",
                "due_date": "2026-04-04",
                "estimated_total_minutes": 120,
                "task_type": "assignment",
            },
        ],
        "study_style": "balanced",
        "max_session_minutes": 90,
    }


def clone_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Return a deep copy so each test mutates its own payload instance."""
    return deepcopy(payload)


def load_output_schema() -> dict[str, Any]:
    schema_path = Path(__file__).resolve().parents[1] / "schemas" / "output.schema.json"
    with schema_path.open("r", encoding="utf-8") as schema_file:
        return json.load(schema_file)


def test_create_plan_happy_path(valid_payload: dict[str, Any]) -> None:
    payload = clone_payload(valid_payload)

    response = client.post("/api/plan", json=payload)

    assert response.status_code == 200
    data = response.json()
    validate(instance=data, schema=load_output_schema())
    assert len(data["schedule"]) > 0


def test_create_plan_rejects_unknown_task_subject(valid_payload: dict[str, Any]) -> None:
    payload = clone_payload(valid_payload)
    payload["tasks"][0]["subject"] = "Physics"

    response = client.post("/api/plan", json=payload)

    assert response.status_code == 422


def test_create_plan_rejects_invalid_timezone(valid_payload: dict[str, Any]) -> None:
    payload = clone_payload(valid_payload)
    payload["timezone"] = "Mars/Olympus_Mons"

    response = client.post("/api/plan", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize("max_minutes", [29, 181])
def test_create_plan_rejects_invalid_max_session_minutes(
    valid_payload: dict[str, Any], max_minutes: int
) -> None:
    payload = clone_payload(valid_payload)
    payload["max_session_minutes"] = max_minutes

    response = client.post("/api/plan", json=payload)

    assert response.status_code == 422


def test_chunking_respects_max_session_minutes(valid_payload: dict[str, Any]) -> None:
    payload = clone_payload(valid_payload)
    payload["week_start_date"] = "2099-01-05"
    payload["daily_hours"] = {
        "monday": 8,
        "tuesday": 8,
        "wednesday": 8,
        "thursday": 8,
        "friday": 8,
        "saturday": 8,
        "sunday": 8,
    }
    payload["subjects"] = [{"name": "Algorithms", "importance": 5}]
    payload["tasks"] = [
        {
            "subject": "Algorithms",
            "title": "Large chapter set",
            "topic": "Comprehensive review",
            "due_date": "2099-01-20",
            "estimated_total_minutes": 200,
            "task_type": "exam",
        }
    ]
    payload["max_session_minutes"] = 60

    response = client.post("/api/plan", json=payload)

    assert response.status_code == 200
    data = response.json()
    subject_entries = [item for item in data["schedule"] if item["subject"] == "Algorithms"]
    assert subject_entries
    assert max(item["minutes"] for item in subject_entries) <= 60
    assert sum(item["minutes"] for item in subject_entries) == 200


def test_urgency_prioritized_when_capacity_is_limited(valid_payload: dict[str, Any]) -> None:
    payload = clone_payload(valid_payload)
    payload["week_start_date"] = "2099-01-05"
    payload["daily_hours"] = {
        "monday": 1,
        "tuesday": 0,
        "wednesday": 0,
        "thursday": 0,
        "friday": 0,
        "saturday": 0,
        "sunday": 0,
    }
    payload["subjects"] = [
        {"name": "Algorithms", "importance": 5},
        {"name": "Databases", "importance": 5},
    ]
    payload["tasks"] = [
        {
            "subject": "Algorithms",
            "title": "Urgent task",
            "topic": "Urgent",
            "due_date": "2099-01-06",
            "estimated_total_minutes": 60,
            "task_type": "exam",
        },
        {
            "subject": "Databases",
            "title": "Later task",
            "topic": "Later",
            "due_date": "2099-01-12",
            "estimated_total_minutes": 60,
            "task_type": "exam",
        },
    ]
    payload["max_session_minutes"] = 60

    response = client.post("/api/plan", json=payload)

    assert response.status_code == 200
    data = response.json()
    scheduled_subjects = [item["subject"] for item in data["schedule"] if item["notes"] == "Core task block"]
    assert "Algorithms" in scheduled_subjects
    assert "Databases" not in scheduled_subjects


def test_review_sessions_added_near_due_dates(valid_payload: dict[str, Any]) -> None:
    payload = clone_payload(valid_payload)
    payload["week_start_date"] = "2099-01-05"
    payload["daily_hours"] = {
        "monday": 2,
        "tuesday": 2,
        "wednesday": 2,
        "thursday": 2,
        "friday": 2,
        "saturday": 2,
        "sunday": 2,
    }
    payload["subjects"] = [{"name": "Algorithms", "importance": 5}]
    payload["tasks"] = [
        {
            "subject": "Algorithms",
            "title": "Quiz prep",
            "topic": "Set theory",
            "due_date": "2099-01-07",
            "estimated_total_minutes": 90,
            "task_type": "quiz",
        }
    ]

    response = client.post("/api/plan", json=payload)

    assert response.status_code == 200
    data = response.json()
    review_entries = [item for item in data["schedule"] if item["activity_type"] == "review"]
    assert data["summary"]["review_sessions"] > 0
    assert len(review_entries) > 0
