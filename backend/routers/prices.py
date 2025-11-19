"""Price-related API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import crud
import schemas

router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("/", response_model=List[schemas.Price])
async def list_prices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    produce_id: Optional[int] = Query(None, description="Filter by produce item"),
    market_id: Optional[int] = Query(None, description="Filter by market"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db)
):
    """
    Get list of current prices with optional filters.

    - **produce_id**: Filter prices for a specific produce item
    - **market_id**: Filter prices for a specific market
    - **category_id**: Filter prices by produce category
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    prices = crud.get_prices(
        db,
        skip=skip,
        limit=limit,
        produce_id=produce_id,
        market_id=market_id,
        category_id=category_id
    )
    return prices


@router.get("/{price_id}", response_model=schemas.Price)
async def get_price(
    price_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific price by ID.

    - **price_id**: ID of the price record
    """
    price = crud.get_price(db, price_id)
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    return price


@router.post("/", response_model=schemas.Price)
async def create_price(
    price: schemas.PriceCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new price entry.

    - **produce_id**: ID of the produce item
    - **market_id**: ID of the market
    - **price**: Price value
    - **currency**: Currency code (default: LKR)
    - **source**: Source of the price data
    """
    # Verify produce and market exist
    produce = crud.get_produce_item(db, price.produce_id)
    if not produce:
        raise HTTPException(status_code=404, detail="Produce item not found")

    market = crud.get_market(db, price.market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    return crud.create_price(db, price)


@router.get("/compare/", response_model=dict)
async def compare_prices(
    produce_ids: str = Query(..., description="Comma-separated produce IDs"),
    market_ids: Optional[str] = Query(None, description="Comma-separated market IDs"),
    db: Session = Depends(get_db)
):
    """
    Compare prices across markets for specified produce items.

    - **produce_ids**: Comma-separated list of produce IDs (e.g., "1,2,3")
    - **market_ids**: Optional comma-separated list of market IDs
    """
    try:
        produce_id_list = [int(x.strip()) for x in produce_ids.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid produce_ids format")

    market_id_list = None
    if market_ids:
        try:
            market_id_list = [int(x.strip()) for x in market_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid market_ids format")

    comparison = crud.compare_prices(db, produce_id_list, market_id_list)

    if not comparison:
        raise HTTPException(status_code=404, detail="No prices found for specified items")

    return comparison


@router.get("/history/{produce_id}", response_model=List[schemas.PriceHistory])
async def get_price_history(
    produce_id: int,
    market_id: Optional[int] = Query(None, description="Filter by market"),
    days: int = Query(30, ge=1, le=365, description="Number of days of history"),
    db: Session = Depends(get_db)
):
    """
    Get price history for a produce item.

    - **produce_id**: ID of the produce item
    - **market_id**: Optional market ID filter
    - **days**: Number of days of history to retrieve (default: 30)
    """
    from datetime import datetime, timedelta

    produce = crud.get_produce_item(db, produce_id)
    if not produce:
        raise HTTPException(status_code=404, detail="Produce item not found")

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days)

    history = crud.get_price_history(
        db,
        produce_id=produce_id,
        market_id=market_id,
        start_date=start_date,
        end_date=end_date
    )

    return history
