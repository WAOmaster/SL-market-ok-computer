"""Shopping list and route optimization API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import crud
import schemas

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


@router.get("/lists", response_model=List[schemas.ShoppingList])
async def list_shopping_lists(
    user_id: str = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Get all shopping lists for a user.

    - **user_id**: ID of the user
    """
    lists = crud.get_shopping_lists(db, user_id)
    return lists


@router.get("/lists/{list_id}", response_model=schemas.ShoppingList)
async def get_shopping_list(
    list_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific shopping list by ID.

    - **list_id**: ID of the shopping list
    """
    shopping_list = crud.get_shopping_list(db, list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    return shopping_list


@router.post("/lists", response_model=schemas.ShoppingList)
async def create_shopping_list(
    shopping_list: schemas.ShoppingListCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new shopping list.

    - **user_id**: ID of the user
    - **name**: Name of the shopping list
    - **budget**: Optional budget limit
    - **items**: List of items to add to the shopping list
    """
    # Verify all produce items exist
    for item in shopping_list.items:
        produce = crud.get_produce_item(db, item.produce_id)
        if not produce:
            raise HTTPException(
                status_code=404,
                detail=f"Produce item {item.produce_id} not found"
            )

    return crud.create_shopping_list(db, shopping_list)


@router.delete("/lists/{list_id}", response_model=schemas.MessageResponse)
async def delete_shopping_list(
    list_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a shopping list.

    - **list_id**: ID of the shopping list to delete
    """
    success = crud.delete_shopping_list(db, list_id)
    if not success:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    return schemas.MessageResponse(message="Shopping list deleted successfully")


@router.get("/lists/{list_id}/optimize", response_model=schemas.OptimizedRoute)
async def optimize_shopping_route(
    list_id: int,
    start_latitude: float = Query(..., description="Starting latitude"),
    start_longitude: float = Query(..., description="Starting longitude"),
    db: Session = Depends(get_db)
):
    """
    Optimize shopping route for a shopping list.

    Calculates the most cost-effective route across markets to purchase
    all items in the shopping list, considering both price and distance.

    - **list_id**: ID of the shopping list
    - **start_latitude**: Starting point latitude
    - **start_longitude**: Starting point longitude

    Returns an optimized route with markets ordered by visit sequence.
    """
    from services.optimizer import RouteOptimizer

    # Get shopping list
    shopping_list = crud.get_shopping_list(db, list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    if not shopping_list.items:
        raise HTTPException(status_code=400, detail="Shopping list is empty")

    # Get all markets
    markets = crud.get_markets(db)
    if not markets:
        raise HTTPException(status_code=404, detail="No markets available")

    # Get current prices for all items
    produce_ids = [item.produce_id for item in shopping_list.items]
    price_comparison = crud.compare_prices(db, produce_ids)

    # Optimize route
    optimizer = RouteOptimizer()
    optimized_route = optimizer.optimize_route(
        shopping_list=shopping_list,
        markets=markets,
        price_data=price_comparison,
        start_location=(start_latitude, start_longitude)
    )

    if not optimized_route:
        raise HTTPException(
            status_code=400,
            detail="Could not generate optimized route. Check if all items have prices."
        )

    return optimized_route


@router.post("/alerts", response_model=schemas.PriceAlert)
async def create_price_alert(
    alert: schemas.PriceAlertCreate,
    db: Session = Depends(get_db)
):
    """
    Create a price alert for a produce item.

    - **user_id**: ID of the user
    - **produce_id**: ID of the produce item to monitor
    - **target_price**: Price threshold to trigger alert
    - **active**: Whether the alert is active (default: true)
    """
    # Verify produce exists
    produce = crud.get_produce_item(db, alert.produce_id)
    if not produce:
        raise HTTPException(status_code=404, detail="Produce item not found")

    return crud.create_price_alert(db, alert)


@router.get("/alerts", response_model=List[schemas.PriceAlert])
async def list_price_alerts(
    user_id: str = Query(..., description="User ID"),
    active_only: bool = Query(True, description="Show only active alerts"),
    db: Session = Depends(get_db)
):
    """
    Get price alerts for a user.

    - **user_id**: ID of the user
    - **active_only**: Filter for active alerts only (default: true)
    """
    alerts = crud.get_price_alerts(db, user_id, active_only)
    return alerts


@router.patch("/alerts/{alert_id}/deactivate", response_model=schemas.PriceAlert)
async def deactivate_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """
    Deactivate a price alert.

    - **alert_id**: ID of the alert to deactivate
    """
    alert = crud.deactivate_price_alert(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Price alert not found")
    return alert
