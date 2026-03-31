from copy import deepcopy
from typing import Any

import pytest
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
