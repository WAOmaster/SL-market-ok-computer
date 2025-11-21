"""Service layer tests."""
import pytest
from datetime import datetime, timedelta, date
from services.predictor import PricePredictor
from services.optimizer import RouteOptimizer
import models


class MockPriceHistory:
    """Mock price history for testing."""
    def __init__(self, price, date_obj):
        self.price = price
        self.date = date_obj
        self.produce_id = 1
        self.market_id = 1


class MockProduceItem:
    """Mock produce item for testing."""
    def __init__(self, id, name, unit):
        self.id = id
        self.name = name
        self.unit = unit


class MockMarket:
    """Mock market for testing."""
    def __init__(self, id, name, lat, lon):
        self.id = id
        self.name = name
        self.latitude = lat
        self.longitude = lon


class MockShoppingListItem:
    """Mock shopping list item for testing."""
    def __init__(self, produce_id, quantity):
        self.produce_id = produce_id
        self.quantity = quantity


class MockShoppingList:
    """Mock shopping list for testing."""
    def __init__(self, id, items):
        self.id = id
        self.items = items


# Price Predictor Tests
class TestPricePredictor:
    """Test price prediction service."""

    def test_predict_prices_basic(self):
        """Test basic price prediction."""
        predictor = PricePredictor()

        # Create mock historical data (30 days)
        history = []
        base_date = date.today() - timedelta(days=30)
        for i in range(30):
            price = 100 + (i % 10)  # Simple pattern
            history.append(MockPriceHistory(price, base_date + timedelta(days=i)))

        # Predict 7 days
        result = predictor.predict_prices(history, days=7)

        assert "predictions" in result
        assert "accuracy" in result
        assert len(result["predictions"]) == 7

        # Check prediction structure
        for pred in result["predictions"]:
            assert hasattr(pred, "date")
            assert hasattr(pred, "predicted_price")
            assert pred.predicted_price > 0

    def test_predict_prices_insufficient_data(self):
        """Test prediction with insufficient data."""
        predictor = PricePredictor()

        # Only 5 days of data (need at least 7)
        history = []
        base_date = date.today()
        for i in range(5):
            history.append(MockPriceHistory(100, base_date - timedelta(days=i)))

        with pytest.raises(ValueError, match="at least 7 days"):
            predictor.predict_prices(history, days=7)

    def test_detect_seasonal_patterns(self):
        """Test seasonal pattern detection."""
        predictor = PricePredictor()

        # Create data with monthly pattern (60 days)
        history = []
        base_date = date.today() - timedelta(days=60)
        for i in range(60):
            # Price varies by month
            month = (base_date + timedelta(days=i)).month
            price = 100 + (month % 3) * 20
            history.append(MockPriceHistory(price, base_date + timedelta(days=i)))

        result = predictor.detect_seasonal_patterns(history)

        assert "has_pattern" in result
        assert "monthly_average" in result
        assert "weekly_average" in result

    def test_detect_patterns_insufficient_data(self):
        """Test pattern detection with insufficient data."""
        predictor = PricePredictor()

        # Only 20 days (need at least 30)
        history = []
        base_date = date.today()
        for i in range(20):
            history.append(MockPriceHistory(100, base_date - timedelta(days=i)))

        result = predictor.detect_seasonal_patterns(history)

        assert result["has_pattern"] is False
        assert "Insufficient data" in result["message"]


# Route Optimizer Tests
class TestRouteOptimizer:
    """Test route optimization service."""

    def test_optimize_route_basic(self):
        """Test basic route optimization."""
        optimizer = RouteOptimizer()

        # Create mock data
        produce1 = MockProduceItem(1, "Tomatoes", "kg")
        produce2 = MockProduceItem(2, "Potatoes", "kg")

        items = [
            MockShoppingListItem(1, 2.0),
            MockShoppingListItem(2, 3.0)
        ]
        shopping_list = MockShoppingList(1, items)

        markets = [
            MockMarket(1, "Market A", 6.9271, 79.8612),
            MockMarket(2, "Market B", 6.9350, 79.8539),
            MockMarket(3, "Market C", 7.2906, 80.6337)
        ]

        price_data = {
            1: {
                "produce_name": "Tomatoes",
                "unit": "kg",
                "prices": [
                    {"market_id": 1, "price": 150.0},
                    {"market_id": 2, "price": 130.0},
                    {"market_id": 3, "price": 140.0}
                ]
            },
            2: {
                "produce_name": "Potatoes",
                "unit": "kg",
                "prices": [
                    {"market_id": 1, "price": 100.0},
                    {"market_id": 2, "price": 110.0},
                    {"market_id": 3, "price": 95.0}
                ]
            }
        }

        start_location = (6.9271, 79.8612)

        result = optimizer.optimize_route(
            shopping_list,
            markets,
            price_data,
            start_location
        )

        assert result is not None
        assert result.shopping_list_id == 1
        assert result.total_estimated_cost > 0
        assert len(result.route) > 0

    def test_assign_items_to_markets(self):
        """Test assigning items to cheapest markets."""
        optimizer = RouteOptimizer()

        items = [
            MockShoppingListItem(1, 2.0),
            MockShoppingListItem(2, 3.0)
        ]
        shopping_list = MockShoppingList(1, items)

        price_data = {
            1: {
                "produce_name": "Tomatoes",
                "unit": "kg",
                "prices": [
                    {"market_id": 1, "price": 150.0},
                    {"market_id": 2, "price": 130.0}
                ]
            },
            2: {
                "produce_name": "Potatoes",
                "unit": "kg",
                "prices": [
                    {"market_id": 1, "price": 100.0},
                    {"market_id": 2, "price": 110.0}
                ]
            }
        }

        assignments = optimizer._assign_items_to_markets(shopping_list, price_data)

        # Tomatoes should be at market 2 (cheaper)
        # Potatoes should be at market 1 (cheaper)
        assert 1 in assignments  # Market 1 has potatoes
        assert 2 in assignments  # Market 2 has tomatoes

    def test_optimize_route_order(self):
        """Test route order optimization."""
        optimizer = RouteOptimizer()

        market_stops = [
            {
                "market_id": 1,
                "market_name": "Market A",
                "latitude": 6.9271,
                "longitude": 79.8612,
                "items": [],
                "estimated_cost": 100
            },
            {
                "market_id": 2,
                "market_name": "Market B",
                "latitude": 6.9350,
                "longitude": 79.8539,
                "items": [],
                "estimated_cost": 150
            }
        ]

        start_location = (6.9271, 79.8612)

        ordered = optimizer._optimize_route_order(market_stops, start_location)

        assert len(ordered) == 2
        # First market should be the one closest to start
        assert ordered[0]["market_id"] == 1

    def test_calculate_total_distance(self):
        """Test total distance calculation."""
        optimizer = RouteOptimizer()

        stops = [
            {
                "latitude": 6.9350,
                "longitude": 79.8539
            },
            {
                "latitude": 7.2906,
                "longitude": 80.6337
            }
        ]

        start = (6.9271, 79.8612)

        distance = optimizer._calculate_total_distance(stops, start)

        assert distance is not None
        assert distance > 0

    def test_calculate_single_market_cost(self):
        """Test single market cost calculation."""
        optimizer = RouteOptimizer()

        items = [
            MockShoppingListItem(1, 2.0),
            MockShoppingListItem(2, 3.0)
        ]
        shopping_list = MockShoppingList(1, items)

        markets = [
            MockMarket(1, "Market A", 6.9271, 79.8612),
            MockMarket(2, "Market B", 6.9350, 79.8539)
        ]

        price_data = {
            1: {
                "produce_name": "Tomatoes",
                "unit": "kg",
                "prices": [
                    {"market_id": 1, "price": 150.0},
                    {"market_id": 2, "price": 130.0}
                ]
            },
            2: {
                "produce_name": "Potatoes",
                "unit": "kg",
                "prices": [
                    {"market_id": 1, "price": 100.0},
                    {"market_id": 2, "price": 110.0}
                ]
            }
        }

        cost = optimizer._calculate_single_market_cost(
            shopping_list,
            markets,
            price_data
        )

        assert cost is not None
        assert cost > 0


# Utility function tests
def test_price_prediction_with_trend():
    """Test price prediction with clear upward trend."""
    predictor = PricePredictor()

    # Create upward trending data
    history = []
    base_date = date.today() - timedelta(days=30)
    for i in range(30):
        price = 100 + (i * 2)  # Clear upward trend
        history.append(MockPriceHistory(price, base_date + timedelta(days=i)))

    result = predictor.predict_prices(history, days=7)

    # Predictions should generally increase
    predictions = result["predictions"]
    first_pred = predictions[0].predicted_price
    last_pred = predictions[-1].predicted_price

    # With upward trend, later predictions should be higher
    assert last_pred >= first_pred - 10  # Allow small variation


def test_route_optimizer_empty_list():
    """Test route optimizer with empty shopping list."""
    optimizer = RouteOptimizer()

    shopping_list = MockShoppingList(1, [])
    markets = [MockMarket(1, "Market A", 6.9271, 79.8612)]
    price_data = {}
    start_location = (6.9271, 79.8612)

    result = optimizer.optimize_route(
        shopping_list,
        markets,
        price_data,
        start_location
    )

    # Should handle empty list gracefully
    assert result is None or result.total_estimated_cost == 0


def test_route_optimizer_no_prices():
    """Test route optimizer when no prices available."""
    optimizer = RouteOptimizer()

    items = [MockShoppingListItem(1, 2.0)]
    shopping_list = MockShoppingList(1, items)
    markets = [MockMarket(1, "Market A", 6.9271, 79.8612)]
    price_data = {}  # No price data
    start_location = (6.9271, 79.8612)

    result = optimizer.optimize_route(
        shopping_list,
        markets,
        price_data,
        start_location
    )

    # Should handle missing prices gracefully
    assert result is None or len(result.route) == 0
