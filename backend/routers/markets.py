"""Market API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import crud
import schemas

router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("/", response_model=List[schemas.Market])
async def list_markets(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get list of all markets.

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    markets = crud.get_markets(db, skip=skip, limit=limit)
    return markets


@router.get("/{market_id}", response_model=schemas.Market)
async def get_market(
    market_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific market by ID.

    - **market_id**: ID of the market
    """
    market = crud.get_market(db, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return market


@router.post("/", response_model=schemas.Market)
async def create_market(
    market: schemas.MarketCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new market.

    - **name**: Name of the market
    - **location**: Location/city name
    - **latitude**: GPS latitude (optional)
    - **longitude**: GPS longitude (optional)
    - **address**: Full address (optional)
    - **contact**: Contact information (optional)
    """
    return crud.create_market(db, market)
