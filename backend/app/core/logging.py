"""Structured logging and correlation ID management."""
import logging
import sys
import json
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional, Any, Dict

# Context variable for request correlation ID
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="system")


def get_correlation_id() -> str:
    """Retrieve current request correlation ID from context."""
    return correlation_id_ctx.get()


def set_correlation_id(req_id: str) -> None:
    """Set correlation ID for the current async task context."""
    correlation_id_ctx.set(req_id)


class JSONFormatter(logging.Formatter):
    """Structured JSON formatter with correlation ID and ISO timestamps."""

    def format(self, record: logging.LogRecord) -> str:
        req_id = get_correlation_id()
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", req_id),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Include exception trace if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Include any extra attributes attached to record
        if hasattr(record, "extra_fields") and isinstance(record.extra_fields, dict):
            log_entry.update(record.extra_fields)

        return json.dumps(log_entry)


class TextConsoleFormatter(logging.Formatter):
    """Readable colored/formatted console logs with correlation ID."""

    def format(self, record: logging.LogRecord) -> str:
        req_id = get_correlation_id()
        timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
        prefix = f"[{timestamp}] [{record.levelname:<5}] [{req_id}]"
        return f"{prefix} {record.getMessage()}"


def setup_logging(log_level: str = "INFO", json_logs: bool = False) -> logging.Logger:
    """Configure root logger with appropriate formatter and level."""
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())

    # Remove existing handlers to avoid duplicates
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    if json_logs:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(TextConsoleFormatter())

    root_logger.addHandler(handler)

    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    return logging.getLogger("cachepilot")
