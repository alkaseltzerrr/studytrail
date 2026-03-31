from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_plan_api_test_suite_scaffold() -> None:
    """Scaffold test to confirm pytest collection and API client setup."""
    assert client is not None
