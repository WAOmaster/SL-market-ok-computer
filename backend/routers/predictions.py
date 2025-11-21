"""Price prediction API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
import crud
import schemas

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("/{produce_id}", response_model=schemas.PricePredictionResponse)
async def get_price_predictions(
    produce_id: int,
    market_id: Optional[int] = Query(None, description="Specific market for prediction"),
    days: int = Query(7, ge=1, le=30, description="Number of days to predict"),
    db: Session = Depends(get_db)
):
    """
    Get price predictions for a produce item.

    - **produce_id**: ID of the produce item
    - **market_id**: Optional market ID for market-specific predictions
    - **days**: Number of days to predict (default: 7, max: 30)

    Returns predictions based on historical price data using machine learning.
    """
    from services.predictor import PricePredictor
    from config import settings

    # Verify produce exists
    produce = crud.get_produce_item(db, produce_id)
    if not produce:
        raise HTTPException(status_code=404, detail="Produce item not found")

    # Verify market if specified
    market = None
    if market_id:
        market = crud.get_market(db, market_id)
        if not market:
            raise HTTPException(status_code=404, detail="Market not found")

    # Get historical data
    from datetime import datetime, timedelta
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=settings.MIN_HISTORICAL_DAYS)

    history = crud.get_price_history(
        db,
        produce_id=produce_id,
        market_id=market_id,
        start_date=start_date,
        end_date=end_date
    )

    if len(history) < 7:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient historical data. Need at least 7 days, got {len(history)}"
        )

    # Generate predictions
    predictor = PricePredictor()
    predictions = predictor.predict_prices(history, days=days)

    response = schemas.PricePredictionResponse(
        produce_id=produce_id,
        produce_name=produce.name,
        market_id=market_id,
        market_name=market.name if market else None,
        predictions=predictions["predictions"],
        model_accuracy=predictions.get("accuracy")
    )

    return response
