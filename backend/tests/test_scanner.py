"""Tests for the Cart Scan scanner endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
from routers.scanner import decode_scale_label

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_scanner.db"
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
def banana():
    """The banana scale label from the sample photos."""
    response = client.post("/api/scanner/catalog", json={
        "code": "923010",
        "name": "Banana - Seeni",
        "unitPrice": 240.0,
        "pricing": "weight",
        "category": "Fruit"
    })
    assert response.status_code == 201
    return response.json()


class TestScaleLabelDecoding:
    """The weight embedded in an in-store label."""

    def test_decodes_weight_and_item_code(self):
        label = decode_scale_label("9230101012188")
        assert label["itemCode"] == "923010"
        assert label["weightKg"] == 1.218
        assert label["checkDigitOk"] is True

    def test_rejects_a_plain_retail_barcode(self):
        assert decode_scale_label("4006381333931") is None

    def test_rejects_junk(self):
        assert decode_scale_label("") is None
        assert decode_scale_label("12345") is None


class TestCatalog:
    """The shared product catalog."""

    def test_product_is_created_then_updated_in_place(self, banana):
        assert banana["code"] == "923010"
        assert banana["unitPrice"] == 240.0

        updated = client.post("/api/scanner/catalog", json={
            "code": "923010",
            "name": "Banana - Seeni",
            "unitPrice": 260.0,
            "pricing": "weight",
            "category": "Fruit"
        })
        assert updated.status_code == 201
        assert updated.json()["unitPrice"] == 260.0
        assert updated.json()["id"] == banana["id"]

    def test_catalog_is_listed_and_searchable(self, banana):
        listing = client.get("/api/scanner/catalog")
        assert listing.status_code == 200
        assert listing.json()["count"] >= 1

        found = client.get("/api/scanner/catalog", params={"search": "banana"})
        assert found.json()["count"] == 1
        assert found.json()["products"][0]["name"] == "Banana - Seeni"

    def test_pricing_mode_is_validated(self):
        response = client.post("/api/scanner/catalog", json={
            "code": "999999",
            "name": "Nonsense",
            "unitPrice": 10,
            "pricing": "per-furlong"
        })
        assert response.status_code == 422

    def test_product_can_be_deleted(self):
        client.post("/api/scanner/catalog", json={
            "code": "914099", "name": "Temporary", "unitPrice": 100, "pricing": "unit"
        })
        assert client.delete("/api/scanner/catalog/914099").status_code == 204
        assert client.delete("/api/scanner/catalog/914099").status_code == 404


class TestLookup:
    """Resolving a scanned code."""

    def test_scale_label_is_priced_from_its_weight(self, banana):
        response = client.get("/api/scanner/lookup/9230101012188")
        assert response.status_code == 200

        body = response.json()
        assert body["found"] is True
        assert body["label"]["weightKg"] == 1.218
        assert body["product"]["name"] == "Banana - Seeni"
        # The total printed on the sticker.
        assert body["lineTotal"] == 292.32

    def test_unknown_code_reports_not_found_without_erroring(self):
        body = client.get("/api/scanner/lookup/4006381333931").json()
        assert body["found"] is False
        assert body["product"] is None

    def test_non_numeric_code_is_rejected(self):
        assert client.get("/api/scanner/lookup/abc").status_code == 422


class TestSessions:
    """Saving a finished trip."""

    payload = {
        "id": "trip-1",
        "store": "Keells - Nugegoda",
        "items": [
            {"code": "923010", "name": "Banana - Seeni", "pricing": "weight",
             "weightKg": 1.218, "unitPrice": 240.0, "lineTotal": 292.32, "category": "Fruit"},
            {"code": "915013", "name": "Potatoes", "pricing": "weight",
             "weightKg": 1.804, "unitPrice": 390.0, "lineTotal": 703.56, "category": "Vegetable"},
            {"code": "4791111", "name": "Milk 1L", "pricing": "unit",
             "qty": 2, "unitPrice": 690.0, "lineTotal": 1380.0, "category": "Dairy"}
        ],
        "totals": {"subtotal": 2375.88, "discount": 0, "tax": 0,
                   "total": 2375.88, "itemCount": 4, "currency": "Rs."}
    }

    def test_trip_is_saved_with_recalculated_totals(self):
        response = client.post("/api/scanner/sessions", json=self.payload)
        assert response.status_code == 201

        body = response.json()
        assert body["store"] == "Keells - Nugegoda"
        assert len(body["items"]) == 3
        assert body["subtotal"] == 2375.88
        assert body["total"] == 2375.88
        # Two weighed packs count once each, the milk counts twice.
        assert body["item_count"] == 4

    def test_client_totals_are_not_trusted(self):
        payload = dict(self.payload)
        payload["totals"] = dict(self.payload["totals"], subtotal=5.0, total=5.0)

        body = client.post("/api/scanner/sessions", json=payload).json()
        assert body["total"] == 2375.88

    def test_missing_line_total_is_computed(self):
        body = client.post("/api/scanner/sessions", json={
            "store": "Cargills",
            "items": [{"name": "Carrot", "pricing": "weight",
                       "weightKg": 0.5, "unitPrice": 690.0}]
        }).json()
        assert body["items"][0]["lineTotal"] == 345.0
        assert body["total"] == 345.0

    def test_saved_trips_are_listed_and_retrievable(self):
        created = client.post("/api/scanner/sessions", json=self.payload).json()

        listing = client.get("/api/scanner/sessions")
        assert listing.status_code == 200
        assert any(s["id"] == created["id"] for s in listing.json())

        single = client.get(f"/api/scanner/sessions/{created['id']}")
        assert single.status_code == 200
        assert len(single.json()["items"]) == 3

    def test_missing_trip_returns_404(self):
        assert client.get("/api/scanner/sessions/999999").status_code == 404
