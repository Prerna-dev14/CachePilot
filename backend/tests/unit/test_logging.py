"""Unit tests for structured logging and correlation IDs."""
import logging
import json
from backend.app.core.logging import (
    set_correlation_id,
    get_correlation_id,
    JSONFormatter
)


def test_correlation_id_context():
    set_correlation_id("test-req-999")
    assert get_correlation_id() == "test-req-999"

    set_correlation_id("test-req-888")
    assert get_correlation_id() == "test-req-888"


def test_json_formatter_structure():
    formatter = JSONFormatter()
    set_correlation_id("req-json-test")

    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="Test message execution",
        args=(),
        exc_info=None
    )

    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert parsed["level"] == "INFO"
    assert parsed["message"] == "Test message execution"
    assert parsed["correlation_id"] == "req-json-test"
    assert "timestamp" in parsed
