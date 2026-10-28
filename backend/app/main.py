"""CachePilot FastAPI Application Entry Point."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import get_settings
from backend.app.core.logging import setup_logging, get_correlation_id
from backend.app.api.middleware import CorrelationIdMiddleware
from backend.app.api.health import router as health_router
from backend.app.api.v1.rag import router as rag_router
from backend.app.api.v1.cache import router as cache_router

settings = get_settings()
logger = setup_logging(log_level=settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager for startup and shutdown routines."""
    logger.info(
        f"Starting CachePilot gateway [env={settings.environment}, llm={settings.default_llm_provider}, embed={settings.default_embedding_provider}]"
    )
    yield
    logger.info("Shutting down CachePilot gateway cleanly.")


app = FastAPI(
    title="CachePilot API",
    description="Scope-Aware Semantic Caching & Cost-Aware Model Routing for RAG",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Correlation ID and Request Timing Middleware
app.add_middleware(CorrelationIdMiddleware)

# Cross-Origin Resource Sharing (CORS) Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler returning standardized JSON envelope
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    req_id = get_correlation_id()
    logger.error(f"Global exception caught on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred while processing your request.",
            "request_id": req_id
        },
        headers={"X-Request-ID": req_id}
    )


# Root information endpoint
@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "CachePilot",
        "description": "Semantic Caching & Cost-Aware Routing RAG Gateway",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health/live",
        "status": "active"
    }


# Mount Routers
app.include_router(health_router)
app.include_router(rag_router)
app.include_router(cache_router)

