"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, date


# Category Schemas
class CategoryBase(BaseModel):
    """Base category schema."""
    name: str
    name_sinhala: Optional[str] = None
    name_tamil: Optional[str] = None
    icon: Optional[str] = None


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""
    pass


class Category(CategoryBase):
    """Category response schema."""
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Market Schemas
class MarketBase(BaseModel):
    """Base market schema."""
    name: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    contact: Optional[str] = None


class MarketCreate(MarketBase):
    """Schema for creating a market."""
    pass


class Market(MarketBase):
    """Market response schema."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ProduceItem Schemas
class ProduceItemBase(BaseModel):
    """Base produce item schema."""
    name: str
    name_sinhala: Optional[str] = None
    name_tamil: Optional[str] = None
    category_id: int
    unit: str = "kg"
    image_url: Optional[str] = None


class ProduceItemCreate(ProduceItemBase):
    """Schema for creating a produce item."""
    pass


class ProduceItem(ProduceItemBase):
    """Produce item response schema."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    category: Optional[Category] = None

    model_config = ConfigDict(from_attributes=True)


# Price Schemas
class PriceBase(BaseModel):
    """Base price schema."""
    produce_id: int
    market_id: int
    price: float = Field(gt=0, description="Price must be greater than 0")
    currency: str = "LKR"
    source: Optional[str] = None


class PriceCreate(PriceBase):
    """Schema for creating a price."""
    pass


class Price(PriceBase):
    """Price response schema."""
    id: int
    timestamp: datetime
    updated_at: Optional[datetime] = None
    produce: Optional[ProduceItem] = None
    market: Optional[Market] = None

    model_config = ConfigDict(from_attributes=True)


# PriceHistory Schemas
class PriceHistoryBase(BaseModel):
    """Base price history schema."""
    produce_id: int
    market_id: int
    price: float
    date: date


class PriceHistoryCreate(PriceHistoryBase):
    """Schema for creating price history."""
    pass


class PriceHistory(PriceHistoryBase):
    """Price history response schema."""
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# PriceAlert Schemas
class PriceAlertBase(BaseModel):
    """Base price alert schema."""
    user_id: str
    produce_id: int
    target_price: float = Field(gt=0)
    active: bool = True


class PriceAlertCreate(PriceAlertBase):
    """Schema for creating a price alert."""
    pass


class PriceAlert(PriceAlertBase):
    """Price alert response schema."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ShoppingList Schemas
class ShoppingListItemBase(BaseModel):
    """Base shopping list item schema."""
    produce_id: int
    quantity: float = Field(gt=0)
    unit: str = "kg"


class ShoppingListItemCreate(ShoppingListItemBase):
    """Schema for creating a shopping list item."""
    pass


class ShoppingListItem(ShoppingListItemBase):
    """Shopping list item response schema."""
    id: int
    list_id: int
    created_at: datetime
    produce: Optional[ProduceItem] = None

    model_config = ConfigDict(from_attributes=True)


class ShoppingListBase(BaseModel):
    """Base shopping list schema."""
    user_id: str
    name: str
    budget: Optional[float] = None


class ShoppingListCreate(ShoppingListBase):
    """Schema for creating a shopping list."""
    items: List[ShoppingListItemCreate] = []


class ShoppingList(ShoppingListBase):
    """Shopping list response schema."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[ShoppingListItem] = []

    model_config = ConfigDict(from_attributes=True)


# Price Comparison Schemas
class PriceComparisonItem(BaseModel):
    """Schema for price comparison across markets."""
    produce_id: int
    produce_name: str
    unit: str
    prices: List[dict]  # List of {market_id, market_name, price, timestamp}


class PriceComparisonResponse(BaseModel):
    """Response schema for price comparison."""
    items: List[PriceComparisonItem]


# Price Prediction Schemas
class PricePrediction(BaseModel):
    """Schema for price predictions."""
    date: date
    predicted_price: float
    confidence_interval_lower: Optional[float] = None
    confidence_interval_upper: Optional[float] = None


class PricePredictionResponse(BaseModel):
    """Response schema for price predictions."""
    produce_id: int
    produce_name: str
    market_id: Optional[int] = None
    market_name: Optional[str] = None
    predictions: List[PricePrediction]
    model_accuracy: Optional[float] = None


# Route Optimization Schemas
class MarketStop(BaseModel):
    """Schema for a market stop in optimized route."""
    market_id: int
    market_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    items: List[dict]  # Items to buy at this market
    estimated_cost: float
    order: int


class OptimizedRoute(BaseModel):
    """Schema for optimized shopping route."""
    shopping_list_id: int
    total_estimated_cost: float
    total_distance_km: Optional[float] = None
    route: List[MarketStop]
    savings_vs_single_market: Optional[float] = None


# Filter and Query Schemas
class PriceFilters(BaseModel):
    """Schema for filtering prices."""
    produce_id: Optional[int] = None
    market_id: Optional[int] = None
    category_id: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    limit: int = Field(default=100, le=1000)
    offset: int = Field(default=0, ge=0)


# General Response Schemas
class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response schema."""
    error: str
    detail: Optional[str] = None
    success: bool = False
