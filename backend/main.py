"""FastAPI application entry point for Sri Lanka Market Price API."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from config import settings
from database import init_db, get_db
import schemas

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize scheduler for background tasks
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.

    Handles:
    - Database initialization
    - Scheduler startup for scraping tasks
    - Cleanup on shutdown
    """
    # Startup
    logger.info("Starting Sri Lanka Market Price API...")

    # Initialize database
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")

    # Start scheduler for periodic scraping
    if settings.SCRAPER_ENABLED:
        from services.scraper import run_scheduled_scraping

        # Schedule scraping job
        scheduler.add_job(
            run_scheduled_scraping,
            'interval',
            hours=settings.SCRAPER_INTERVAL_HOURS,
            id='price_scraper',
            args=[next(get_db())]
        )
        scheduler.start()
        logger.info(
            f"Scheduler started: scraping every {settings.SCRAPER_INTERVAL_HOURS} hours"
        )

    yield

    # Shutdown
    logger.info("Shutting down...")
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")


# Create FastAPI application
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description=settings.API_DESCRIPTION,
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions with custom response format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "success": False
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else None,
            "success": False
        }
    )


# Include routers
from routers import prices, produce, markets, predictions, shopping, scanner

app.include_router(prices.router)
app.include_router(produce.router)
app.include_router(markets.router)
app.include_router(predictions.router)
app.include_router(shopping.router)
app.include_router(scanner.router)


# Root endpoint
@app.get("/", response_model=dict)
async def root():
    """
    Root endpoint with API information.

    Returns basic API info and available endpoints.
    """
    return {
        "name": settings.API_TITLE,
        "version": settings.API_VERSION,
        "description": settings.API_DESCRIPTION,
        "docs_url": "/docs",
        "endpoints": {
            "prices": "/api/prices",
            "produce": "/api/produce",
            "markets": "/api/markets",
            "predictions": "/api/predictions",
            "shopping": "/api/shopping"
        },
        "status": "operational"
    }


# Health check endpoint
@app.get("/health", response_model=dict)
async def health_check():
    """
    Health check endpoint.

    Returns the current health status of the API.
    """
    from database import engine
    from sqlalchemy import text

    # Check database connection
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        db_status = "error"

    return {
        "status": "healthy" if db_status == "ok" else "unhealthy",
        "database": db_status,
        "scheduler": "running" if scheduler.running else "stopped",
        "timestamp": schemas.datetime.now().isoformat()
    }


# Categories endpoint (additional helper endpoint)
from fastapi import Depends, Query
from sqlalchemy.orm import Session
from typing import List
import crud


@app.get("/api/categories", response_model=List[schemas.Category], tags=["categories"])
async def list_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get list of all produce categories.

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    categories = crud.get_categories(db, skip=skip, limit=limit)
    return categories


@app.post("/api/categories", response_model=schemas.Category, tags=["categories"])
async def create_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new category.

    - **name**: Category name (English)
    - **name_sinhala**: Sinhala translation (optional)
    - **name_tamil**: Tamil translation (optional)
    - **icon**: Icon identifier (optional)
    """
    return crud.create_category(db, category)


# Run the application
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning"
    )
