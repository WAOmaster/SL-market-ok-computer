"""API endpoint tests."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
import schemas

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Setup test database before tests and teardown after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_category():
    """Create a test category."""
    response = client.post(
        "/api/categories",
        json={
            "name": "Test Category",
            "name_sinhala": "පරීක්ෂණ කාණ්ඩය",
            "icon": "🧪"
        }
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def test_market():
    """Create a test market."""
    response = client.post(
        "/api/markets",
        json={
            "name": "Test Market",
            "location": "Test City",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "address": "Test Address"
        }
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def test_produce(test_category):
    """Create a test produce item."""
    response = client.post(
        "/api/produce",
        json={
            "name": "Test Produce",
            "name_sinhala": "පරීක්ෂණ නිෂ්පාදනය",
            "category_id": test_category["id"],
            "unit": "kg"
        }
    )
    assert response.status_code == 200
    return response.json()


# Root endpoint tests
def test_read_root():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert "endpoints" in data


def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data


# Category tests
def test_create_category():
    """Test category creation."""
    response = client.post(
        "/api/categories",
        json={
            "name": "Vegetables",
            "name_sinhala": "එළවළු",
            "name_tamil": "காய்கறிகள்",
            "icon": "🥬"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Vegetables"
    assert "id" in data


def test_list_categories(test_category):
    """Test listing categories."""
    response = client.get("/api/categories")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


# Market tests
def test_create_market():
    """Test market creation."""
    response = client.post(
        "/api/markets",
        json={
            "name": "Manning Market",
            "location": "Colombo",
            "latitude": 6.9271,
            "longitude": 79.8612
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Manning Market"
    assert "id" in data


def test_list_markets(test_market):
    """Test listing markets."""
    response = client.get("/api/markets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_market(test_market):
    """Test getting a specific market."""
    market_id = test_market["id"]
    response = client.get(f"/api/markets/{market_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == market_id


# Produce tests
def test_create_produce(test_category):
    """Test produce item creation."""
    response = client.post(
        "/api/produce",
        json={
            "name": "Tomatoes",
            "name_sinhala": "තක්කාලි",
            "category_id": test_category["id"],
            "unit": "kg"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Tomatoes"
    assert "id" in data


def test_list_produce(test_produce):
    """Test listing produce items."""
    response = client.get("/api/produce")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_produce(test_produce):
    """Test getting a specific produce item."""
    produce_id = test_produce["id"]
    response = client.get(f"/api/produce/{produce_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == produce_id


# Price tests
def test_create_price(test_produce, test_market):
    """Test price creation."""
    response = client.post(
        "/api/prices",
        json={
            "produce_id": test_produce["id"],
            "market_id": test_market["id"],
            "price": 150.50,
            "currency": "LKR"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["price"] == 150.50
    assert "id" in data


def test_list_prices(test_produce, test_market):
    """Test listing prices."""
    # Create a price first
    client.post(
        "/api/prices",
        json={
            "produce_id": test_produce["id"],
            "market_id": test_market["id"],
            "price": 150.50
        }
    )

    response = client.get("/api/prices")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_filter_prices_by_produce(test_produce, test_market):
    """Test filtering prices by produce."""
    # Create a price
    client.post(
        "/api/prices",
        json={
            "produce_id": test_produce["id"],
            "market_id": test_market["id"],
            "price": 150.50
        }
    )

    response = client.get(f"/api/prices?produce_id={test_produce['id']}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# Shopping list tests
def test_create_shopping_list(test_produce):
    """Test shopping list creation."""
    response = client.post(
        "/api/shopping/lists",
        json={
            "user_id": "test_user_1",
            "name": "My Shopping List",
            "budget": 5000.00,
            "items": [
                {
                    "produce_id": test_produce["id"],
                    "quantity": 2.0,
                    "unit": "kg"
                }
            ]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "My Shopping List"
    assert len(data["items"]) == 1


def test_list_shopping_lists(test_produce):
    """Test listing shopping lists."""
    # Create a shopping list first
    client.post(
        "/api/shopping/lists",
        json={
            "user_id": "test_user_2",
            "name": "Test List",
            "items": [
                {
                    "produce_id": test_produce["id"],
                    "quantity": 1.0,
                    "unit": "kg"
                }
            ]
        }
    )

    response = client.get("/api/shopping/lists?user_id=test_user_2")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# Price alert tests
def test_create_price_alert(test_produce):
    """Test price alert creation."""
    response = client.post(
        "/api/shopping/alerts",
        json={
            "user_id": "test_user_1",
            "produce_id": test_produce["id"],
            "target_price": 100.00,
            "active": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["target_price"] == 100.00


def test_list_price_alerts(test_produce):
    """Test listing price alerts."""
    # Create an alert first
    client.post(
        "/api/shopping/alerts",
        json={
            "user_id": "test_user_3",
            "produce_id": test_produce["id"],
            "target_price": 100.00
        }
    )

    response = client.get("/api/shopping/alerts?user_id=test_user_3")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# Error handling tests
def test_get_nonexistent_market():
    """Test getting a non-existent market."""
    response = client.get("/api/markets/99999")
    assert response.status_code == 404


def test_get_nonexistent_produce():
    """Test getting a non-existent produce item."""
    response = client.get("/api/produce/99999")
    assert response.status_code == 404


def test_create_price_invalid_produce():
    """Test creating price with invalid produce ID."""
    response = client.post(
        "/api/prices",
        json={
            "produce_id": 99999,
            "market_id": 1,
            "price": 100.00
        }
    )
    assert response.status_code == 404


# Validation tests
def test_create_price_negative_value():
    """Test creating price with negative value."""
    response = client.post(
        "/api/prices",
        json={
            "produce_id": 1,
            "market_id": 1,
            "price": -100.00
        }
    )
    assert response.status_code == 422  # Validation error
