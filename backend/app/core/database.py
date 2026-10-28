"""Database connection management and health checks."""
import time
import logging
from typing import AsyncGenerator, Dict, Any
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Engine creation with pool settings
engine = None
AsyncSessionLocal = None


def get_engine():
    global engine, AsyncSessionLocal
    if engine is None:
        try:
            # Handle SQLite vs PostgreSQL async dialect
            is_sqlite = "sqlite" in settings.database_url
            connect_args = {"check_same_thread": False} if is_sqlite else {}

            engine = create_async_engine(
                settings.database_url,
                echo=settings.debug,
                pool_pre_ping=True,
                connect_args=connect_args,
                **({} if is_sqlite else {
                    "pool_size": settings.database_pool_size,
                    "max_overflow": settings.database_max_overflow,
                })
            )
            AsyncSessionLocal = async_sessionmaker(
                bind=engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False
            )
        except Exception as e:
            logger.error(f"Failed to create database engine: {e}")
            raise
    return engine


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for yielding an async database session."""
    get_engine()
    if AsyncSessionLocal is None:
        raise RuntimeError("Database session maker not initialized")
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def check_database_health() -> Dict[str, Any]:
    """Verify database connectivity and measure query roundtrip latency."""
    start_time = time.perf_counter()
    try:
        current_engine = get_engine()
        async with current_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "status": "connected",
            "latency_ms": latency_ms
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "status": "unhealthy",
            "latency_ms": latency_ms,
            "error": str(e)
        }
