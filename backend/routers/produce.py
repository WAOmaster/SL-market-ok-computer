"""Produce item API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import crud
import schemas

router = APIRouter(prefix="/api/produce", tags=["produce"])


@router.get("/", response_model=List[schemas.ProduceItem])
async def list_produce_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db)
):
    """
    Get list of all produce items.

    - **category_id**: Optional filter by category
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    items = crud.get_produce_items(
        db,
        skip=skip,
        limit=limit,
        category_id=category_id
    )
    return items


@router.get("/{produce_id}", response_model=schemas.ProduceItem)
async def get_produce_item(
    produce_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific produce item by ID.

    - **produce_id**: ID of the produce item
    """
    item = crud.get_produce_item(db, produce_id)
    if not item:
        raise HTTPException(status_code=404, detail="Produce item not found")
    return item


@router.post("/", response_model=schemas.ProduceItem)
async def create_produce_item(
    produce: schemas.ProduceItemCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new produce item.

    - **name**: Name of the produce item
    - **name_sinhala**: Sinhala translation (optional)
    - **name_tamil**: Tamil translation (optional)
    - **category_id**: Category ID
    - **unit**: Unit of measurement (default: kg)
    - **image_url**: URL to image (optional)
    """
    # Verify category exists
    category = crud.get_category(db, produce.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    return crud.create_produce_item(db, produce)
