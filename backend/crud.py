"""CRUD operations for database models."""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc
from typing import List, Optional
from datetime import datetime, date
import models
import schemas


# Category CRUD
def get_categories(db: Session, skip: int = 0, limit: int = 100) -> List[models.Category]:
    """Get all categories."""
    return db.query(models.Category).offset(skip).limit(limit).all()


def get_category(db: Session, category_id: int) -> Optional[models.Category]:
    """Get a category by ID."""
    return db.query(models.Category).filter(models.Category.id == category_id).first()


def create_category(db: Session, category: schemas.CategoryCreate) -> models.Category:
    """Create a new category."""
    db_category = models.Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


# Market CRUD
def get_markets(db: Session, skip: int = 0, limit: int = 100) -> List[models.Market]:
    """Get all markets."""
    return db.query(models.Market).offset(skip).limit(limit).all()


def get_market(db: Session, market_id: int) -> Optional[models.Market]:
    """Get a market by ID."""
    return db.query(models.Market).filter(models.Market.id == market_id).first()


def create_market(db: Session, market: schemas.MarketCreate) -> models.Market:
    """Create a new market."""
    db_market = models.Market(**market.model_dump())
    db.add(db_market)
    db.commit()
    db.refresh(db_market)
    return db_market


# ProduceItem CRUD
def get_produce_items(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[int] = None
) -> List[models.ProduceItem]:
    """Get all produce items, optionally filtered by category."""
    query = db.query(models.ProduceItem).options(joinedload(models.ProduceItem.category))

    if category_id:
        query = query.filter(models.ProduceItem.category_id == category_id)

    return query.offset(skip).limit(limit).all()


def get_produce_item(db: Session, produce_id: int) -> Optional[models.ProduceItem]:
    """Get a produce item by ID."""
    return db.query(models.ProduceItem).options(
        joinedload(models.ProduceItem.category)
    ).filter(models.ProduceItem.id == produce_id).first()


def create_produce_item(db: Session, produce: schemas.ProduceItemCreate) -> models.ProduceItem:
    """Create a new produce item."""
    db_produce = models.ProduceItem(**produce.model_dump())
    db.add(db_produce)
    db.commit()
    db.refresh(db_produce)
    return db_produce


# Price CRUD
def get_prices(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    produce_id: Optional[int] = None,
    market_id: Optional[int] = None,
    category_id: Optional[int] = None
) -> List[models.Price]:
    """Get prices with optional filters."""
    query = db.query(models.Price).options(
        joinedload(models.Price.produce).joinedload(models.ProduceItem.category),
        joinedload(models.Price.market)
    )

    if produce_id:
        query = query.filter(models.Price.produce_id == produce_id)

    if market_id:
        query = query.filter(models.Price.market_id == market_id)

    if category_id:
        query = query.join(models.ProduceItem).filter(
            models.ProduceItem.category_id == category_id
        )

    return query.order_by(desc(models.Price.timestamp)).offset(skip).limit(limit).all()


def get_price(db: Session, price_id: int) -> Optional[models.Price]:
    """Get a price by ID."""
    return db.query(models.Price).options(
        joinedload(models.Price.produce),
        joinedload(models.Price.market)
    ).filter(models.Price.id == price_id).first()


def create_price(db: Session, price: schemas.PriceCreate) -> models.Price:
    """Create a new price entry."""
    db_price = models.Price(**price.model_dump())
    db.add(db_price)
    db.commit()
    db.refresh(db_price)
    return db_price


def get_latest_price(
    db: Session,
    produce_id: int,
    market_id: int
) -> Optional[models.Price]:
    """Get the latest price for a produce item at a specific market."""
    return db.query(models.Price).filter(
        and_(
            models.Price.produce_id == produce_id,
            models.Price.market_id == market_id
        )
    ).order_by(desc(models.Price.timestamp)).first()


def update_or_create_price(
    db: Session,
    produce_id: int,
    market_id: int,
    price: float,
    source: Optional[str] = None
) -> models.Price:
    """Update existing price or create new one."""
    existing_price = get_latest_price(db, produce_id, market_id)

    if existing_price:
        existing_price.price = price
        existing_price.timestamp = datetime.utcnow()
        if source:
            existing_price.source = source
        db.commit()
        db.refresh(existing_price)
        return existing_price
    else:
        price_data = schemas.PriceCreate(
            produce_id=produce_id,
            market_id=market_id,
            price=price,
            source=source
        )
        return create_price(db, price_data)


# PriceHistory CRUD
def get_price_history(
    db: Session,
    produce_id: int,
    market_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> List[models.PriceHistory]:
    """Get price history for a produce item."""
    query = db.query(models.PriceHistory).filter(
        models.PriceHistory.produce_id == produce_id
    )

    if market_id:
        query = query.filter(models.PriceHistory.market_id == market_id)

    if start_date:
        query = query.filter(models.PriceHistory.date >= start_date)

    if end_date:
        query = query.filter(models.PriceHistory.date <= end_date)

    return query.order_by(models.PriceHistory.date).all()


def create_price_history(
    db: Session,
    price_history: schemas.PriceHistoryCreate
) -> models.PriceHistory:
    """Create a new price history entry."""
    db_history = models.PriceHistory(**price_history.model_dump())
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history


# PriceAlert CRUD
def get_price_alerts(
    db: Session,
    user_id: str,
    active_only: bool = True
) -> List[models.PriceAlert]:
    """Get price alerts for a user."""
    query = db.query(models.PriceAlert).filter(
        models.PriceAlert.user_id == user_id
    )

    if active_only:
        query = query.filter(models.PriceAlert.active == True)

    return query.all()


def create_price_alert(
    db: Session,
    alert: schemas.PriceAlertCreate
) -> models.PriceAlert:
    """Create a new price alert."""
    db_alert = models.PriceAlert(**alert.model_dump())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


def deactivate_price_alert(db: Session, alert_id: int) -> Optional[models.PriceAlert]:
    """Deactivate a price alert."""
    alert = db.query(models.PriceAlert).filter(models.PriceAlert.id == alert_id).first()
    if alert:
        alert.active = False
        db.commit()
        db.refresh(alert)
    return alert


# ShoppingList CRUD
def get_shopping_lists(db: Session, user_id: str) -> List[models.ShoppingList]:
    """Get all shopping lists for a user."""
    return db.query(models.ShoppingList).options(
        joinedload(models.ShoppingList.items).joinedload(models.ShoppingListItem.produce)
    ).filter(models.ShoppingList.user_id == user_id).all()


def get_shopping_list(db: Session, list_id: int) -> Optional[models.ShoppingList]:
    """Get a shopping list by ID."""
    return db.query(models.ShoppingList).options(
        joinedload(models.ShoppingList.items).joinedload(models.ShoppingListItem.produce)
    ).filter(models.ShoppingList.id == list_id).first()


def create_shopping_list(
    db: Session,
    shopping_list: schemas.ShoppingListCreate
) -> models.ShoppingList:
    """Create a new shopping list with items."""
    # Create shopping list
    list_data = {
        "user_id": shopping_list.user_id,
        "name": shopping_list.name,
        "budget": shopping_list.budget
    }
    db_list = models.ShoppingList(**list_data)
    db.add(db_list)
    db.flush()

    # Add items
    for item in shopping_list.items:
        db_item = models.ShoppingListItem(
            list_id=db_list.id,
            **item.model_dump()
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_list)
    return db_list


def delete_shopping_list(db: Session, list_id: int) -> bool:
    """Delete a shopping list."""
    shopping_list = db.query(models.ShoppingList).filter(
        models.ShoppingList.id == list_id
    ).first()

    if shopping_list:
        db.delete(shopping_list)
        db.commit()
        return True
    return False


# Comparison Functions
def compare_prices(
    db: Session,
    produce_ids: List[int],
    market_ids: Optional[List[int]] = None
) -> dict:
    """Compare prices across markets for specified produce items."""
    query = db.query(models.Price).options(
        joinedload(models.Price.produce),
        joinedload(models.Price.market)
    ).filter(models.Price.produce_id.in_(produce_ids))

    if market_ids:
        query = query.filter(models.Price.market_id.in_(market_ids))

    prices = query.all()

    # Group by produce_id
    result = {}
    for price in prices:
        if price.produce_id not in result:
            result[price.produce_id] = {
                "produce_name": price.produce.name,
                "unit": price.produce.unit,
                "prices": []
            }

        result[price.produce_id]["prices"].append({
            "market_id": price.market_id,
            "market_name": price.market.name,
            "price": price.price,
            "timestamp": price.timestamp
        })

    return result
