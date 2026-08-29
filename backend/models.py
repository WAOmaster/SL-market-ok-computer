"""Database models for the Market Price API."""
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Date
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Market(Base):
    """Market model representing physical markets in Sri Lanka."""

    __tablename__ = "markets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    location = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(Text, nullable=True)
    contact = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    prices = relationship("Price", back_populates="market", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="market", cascade="all, delete-orphan")


class Category(Base):
    """Category model for organizing produce items."""

    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    name_sinhala = Column(String(100), nullable=True)
    name_tamil = Column(String(100), nullable=True)
    icon = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    produce_items = relationship("ProduceItem", back_populates="category", cascade="all, delete-orphan")


class ProduceItem(Base):
    """ProduceItem model representing items available in markets."""

    __tablename__ = "produce_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    name_sinhala = Column(String(255), nullable=True)
    name_tamil = Column(String(255), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    unit = Column(String(50), nullable=False, default="kg")
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    category = relationship("Category", back_populates="produce_items")
    prices = relationship("Price", back_populates="produce", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="produce", cascade="all, delete-orphan")
    shopping_list_items = relationship("ShoppingListItem", back_populates="produce", cascade="all, delete-orphan")
    price_alerts = relationship("PriceAlert", back_populates="produce", cascade="all, delete-orphan")


class Price(Base):
    """Current price model for produce items at markets."""

    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, index=True)
    produce_id = Column(Integer, ForeignKey("produce_items.id"), nullable=False, index=True)
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=False, index=True)
    price = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="LKR")
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    source = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    produce = relationship("ProduceItem", back_populates="prices")
    market = relationship("Market", back_populates="prices")


class PriceHistory(Base):
    """Historical price data for trend analysis and predictions."""

    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    produce_id = Column(Integer, ForeignKey("produce_items.id"), nullable=False, index=True)
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=False, index=True)
    price = Column(Float, nullable=False)
    date = Column(Date, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    produce = relationship("ProduceItem", back_populates="price_history")
    market = relationship("Market", back_populates="price_history")


class PriceAlert(Base):
    """Price alert model for notifying users of price changes."""

    __tablename__ = "price_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    produce_id = Column(Integer, ForeignKey("produce_items.id"), nullable=False)
    target_price = Column(Float, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    produce = relationship("ProduceItem", back_populates="price_alerts")


class ShoppingList(Base):
    """Shopping list model for user grocery planning."""

    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    budget = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    items = relationship("ShoppingListItem", back_populates="shopping_list", cascade="all, delete-orphan")


class ShoppingListItem(Base):
    """Items in a shopping list."""

    __tablename__ = "shopping_list_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("shopping_lists.id"), nullable=False)
    produce_id = Column(Integer, ForeignKey("produce_items.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False, default="kg")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    shopping_list = relationship("ShoppingList", back_populates="items")
    produce = relationship("ProduceItem", back_populates="shopping_list_items")


class ScannerProduct(Base):
    """
    A code the scanner app knows how to price.

    `code` is whatever identifies the item on the shelf: a full EAN-13 for a
    packet, or the item code embedded in a scale label for loose produce
    (923010 = Banana Seeni). Devices share this table so a product named on one
    phone is recognised on every other.
    """

    __tablename__ = "scanner_products"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    unit_price = Column(Float, nullable=False, default=0.0)
    # "unit" = counted, "weight" = priced per kilogram
    pricing = Column(String(16), nullable=False, default="unit")
    unit = Column(String(16), nullable=False, default="pc")
    category = Column(String(100), nullable=True, default="Other")
    produce_item_id = Column(Integer, ForeignKey("produce_items.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ScanSession(Base):
    """One shopping trip: everything scanned into the trolley, and its total."""

    __tablename__ = "scan_sessions"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String(64), nullable=True, index=True)
    store = Column(String(255), nullable=True)
    currency = Column(String(8), nullable=False, default="Rs.")
    subtotal = Column(Float, nullable=False, default=0.0)
    discount = Column(Float, nullable=False, default=0.0)
    tax = Column(Float, nullable=False, default=0.0)
    total = Column(Float, nullable=False, default=0.0)
    item_count = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship(
        "ScanSessionItem", back_populates="session", cascade="all, delete-orphan"
    )


class ScanSessionItem(Base):
    """A single line of a scanned trip."""

    __tablename__ = "scan_session_items"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("scan_sessions.id"), nullable=False)
    code = Column(String(32), nullable=True, index=True)
    barcode = Column(String(32), nullable=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    pricing = Column(String(16), nullable=False, default="unit")
    quantity = Column(Integer, nullable=False, default=1)
    weight_kg = Column(Float, nullable=False, default=0.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    line_total = Column(Float, nullable=False, default=0.0)
    source = Column(String(16), nullable=True)

    session = relationship("ScanSession", back_populates="items")
