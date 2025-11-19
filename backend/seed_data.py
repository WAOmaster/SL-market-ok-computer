"""Seed data script for populating the database with test data."""
import logging
from datetime import datetime, timedelta, date
import random
from database import SessionLocal, init_db
import crud
import schemas

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_categories(db):
    """Create product categories."""
    categories = [
        {"name": "Vegetables", "name_sinhala": "එළවළු", "name_tamil": "காய்கறிகள்", "icon": "🥬"},
        {"name": "Fruits", "name_sinhala": "පලතුරු", "name_tamil": "பழங்கள்", "icon": "🍎"},
        {"name": "Rice & Grains", "name_sinhala": "සහල් හා ධාන්‍ය", "name_tamil": "அரிசி மற்றும் தானியங்கள்", "icon": "🌾"},
        {"name": "Spices", "name_sinhala": "කුළුබඩු", "name_tamil": "மசாலா", "icon": "🌶️"},
        {"name": "Fish & Seafood", "name_sinhala": "මාළු", "name_tamil": "மீன் மற்றும் கடல் உணவு", "icon": "🐟"},
        {"name": "Meat & Poultry", "name_sinhala": "මස්", "name_tamil": "இறைச்சி", "icon": "🍗"},
        {"name": "Dairy", "name_sinhala": "කිරි නිෂ්පාදන", "name_tamil": "பால் பொருட்கள்", "icon": "🥛"}
    ]

    created_categories = []
    for cat_data in categories:
        category = schemas.CategoryCreate(**cat_data)
        db_category = crud.create_category(db, category)
        created_categories.append(db_category)
        logger.info(f"Created category: {db_category.name}")

    return created_categories


def seed_markets(db):
    """Create market locations."""
    markets = [
        {
            "name": "Manning Market",
            "location": "Colombo",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "address": "Manning Place, Colombo 08",
            "contact": "+94 11 2 123456"
        },
        {
            "name": "Pettah Market",
            "location": "Colombo",
            "latitude": 6.9350,
            "longitude": 79.8539,
            "address": "Main Street, Pettah, Colombo 11",
            "contact": "+94 11 2 234567"
        },
        {
            "name": "Dambulla Economic Centre",
            "location": "Dambulla",
            "latitude": 7.8731,
            "longitude": 80.6520,
            "address": "Dambulla-Anuradhapura Road, Dambulla",
            "contact": "+94 66 2 284567"
        },
        {
            "name": "Kandy Municipal Market",
            "location": "Kandy",
            "latitude": 7.2906,
            "longitude": 80.6337,
            "address": "Market Street, Kandy",
            "contact": "+94 81 2 223456"
        },
        {
            "name": "Galle Main Market",
            "location": "Galle",
            "latitude": 6.0535,
            "longitude": 80.2210,
            "address": "Main Street, Galle Fort, Galle",
            "contact": "+94 91 2 234567"
        }
    ]

    created_markets = []
    for market_data in markets:
        market = schemas.MarketCreate(**market_data)
        db_market = crud.create_market(db, market)
        created_markets.append(db_market)
        logger.info(f"Created market: {db_market.name}")

    return created_markets


def seed_produce_items(db, categories):
    """Create produce items."""
    # Map category names to IDs
    cat_map = {cat.name: cat.id for cat in categories}

    produce_items = [
        # Vegetables
        {"name": "Tomatoes", "name_sinhala": "තක්කාලි", "name_tamil": "தக்காளி", "category_id": cat_map["Vegetables"], "unit": "kg"},
        {"name": "Potatoes", "name_sinhala": "අල", "name_tamil": "உருளைக்கிழங்கு", "category_id": cat_map["Vegetables"], "unit": "kg"},
        {"name": "Onions (Red)", "name_sinhala": "ලූණු (රතු)", "name_tamil": "வெங்காயம்", "category_id": cat_map["Vegetables"], "unit": "kg"},
        {"name": "Carrots", "name_sinhala": "කැරට්", "name_tamil": "கேரட்", "category_id": cat_map["Vegetables"], "unit": "kg"},
        {"name": "Cabbage", "name_sinhala": "ගෝවා", "name_tamil": "முட்டைகோஸ்", "category_id": cat_map["Vegetables"], "unit": "kg"},
        {"name": "Green Beans", "name_sinhala": "බෝංචි", "name_tamil": "பீன்ஸ்", "category_id": cat_map["Vegetables"], "unit": "kg"},
        {"name": "Eggplant", "name_sinhala": "වම්බටු", "name_tamil": "கத்தரிக்காய்", "category_id": cat_map["Vegetables"], "unit": "kg"},

        # Fruits
        {"name": "Bananas", "name_sinhala": "කෙසෙල්", "name_tamil": "வாழைப்பழம்", "category_id": cat_map["Fruits"], "unit": "dozen"},
        {"name": "Papaya", "name_sinhala": "පැපොල්", "name_tamil": "பப்பாளி", "category_id": cat_map["Fruits"], "unit": "kg"},
        {"name": "Mango", "name_sinhala": "අඹ", "name_tamil": "மாம்பழம்", "category_id": cat_map["Fruits"], "unit": "kg"},
        {"name": "Pineapple", "name_sinhala": "අන්නාසි", "name_tamil": "அன்னாசி", "category_id": cat_map["Fruits"], "unit": "each"},
        {"name": "Watermelon", "name_sinhala": "කොමඩු", "name_tamil": "தர்பூசணி", "category_id": cat_map["Fruits"], "unit": "kg"},

        # Rice & Grains
        {"name": "White Rice (Samba)", "name_sinhala": "සම්බා සහල්", "name_tamil": "சம்பா அரிசி", "category_id": cat_map["Rice & Grains"], "unit": "kg"},
        {"name": "Red Rice (Nadu)", "name_sinhala": "රතු හාල්", "name_tamil": "சிவப்பு அரிசி", "category_id": cat_map["Rice & Grains"], "unit": "kg"},
        {"name": "Lentils (Red)", "name_sinhala": "පරිප්පු", "name_tamil": "பருப்பு", "category_id": cat_map["Rice & Grains"], "unit": "kg"},

        # Spices
        {"name": "Chili Powder", "name_sinhala": "මිරිස් කුඩු", "name_tamil": "மிளகாய் தூள்", "category_id": cat_map["Spices"], "unit": "g"},
        {"name": "Turmeric", "name_sinhala": "කහ", "name_tamil": "மஞ்சள்", "category_id": cat_map["Spices"], "unit": "g"},
        {"name": "Cinnamon", "name_sinhala": "කුරුඳු", "name_tamil": "இலவங்கப்பட்டை", "category_id": cat_map["Spices"], "unit": "g"},

        # Fish & Seafood
        {"name": "Tuna", "name_sinhala": "කෙල්ලවල්ලා", "name_tamil": "சூரை", "category_id": cat_map["Fish & Seafood"], "unit": "kg"},
        {"name": "Prawns", "name_sinhala": "ඉස්සන්", "name_tamil": "இறால்", "category_id": cat_map["Fish & Seafood"], "unit": "kg"},

        # Meat & Poultry
        {"name": "Chicken", "name_sinhala": "කුකුළු මස්", "name_tamil": "கோழி இறைச்சி", "category_id": cat_map["Meat & Poultry"], "unit": "kg"},

        # Dairy
        {"name": "Fresh Milk", "name_sinhala": "නැවුම් කිරි", "name_tamil": "புதிய பால்", "category_id": cat_map["Dairy"], "unit": "liter"}
    ]

    created_items = []
    for item_data in produce_items:
        item = schemas.ProduceItemCreate(**item_data)
        db_item = crud.create_produce_item(db, item)
        created_items.append(db_item)
        logger.info(f"Created produce item: {db_item.name}")

    return created_items


def seed_prices(db, produce_items, markets):
    """Create current prices for produce items."""
    # Base prices for different produce types (in LKR)
    base_prices = {
        "Vegetables": (50, 200),
        "Fruits": (80, 300),
        "Rice & Grains": (100, 250),
        "Spices": (200, 800),
        "Fish & Seafood": (600, 1500),
        "Meat & Poultry": (800, 1200),
        "Dairy": (180, 250)
    }

    created_prices = []

    for produce in produce_items:
        category_name = produce.category.name
        price_range = base_prices.get(category_name, (50, 200))

        for market in markets:
            # Generate price with some variation per market
            base_price = random.uniform(*price_range)
            market_variation = random.uniform(0.85, 1.15)
            price = round(base_price * market_variation, 2)

            price_data = schemas.PriceCreate(
                produce_id=produce.id,
                market_id=market.id,
                price=price,
                source="seed_data"
            )

            db_price = crud.create_price(db, price_data)
            created_prices.append(db_price)

    logger.info(f"Created {len(created_prices)} price entries")
    return created_prices


def seed_price_history(db, produce_items, markets):
    """Create historical price data for trend analysis."""
    created_history = []
    end_date = date.today()
    start_date = end_date - timedelta(days=60)

    # Generate daily prices for the last 60 days
    current_date = start_date
    while current_date <= end_date:
        for produce in produce_items[:10]:  # First 10 items for demo
            for market in markets[:3]:  # First 3 markets
                # Get or create base price
                latest_price = crud.get_latest_price(db, produce.id, market.id)
                if latest_price:
                    base = latest_price.price
                else:
                    base = random.uniform(50, 500)

                # Add random daily variation (±10%)
                variation = random.uniform(0.9, 1.1)
                price = round(base * variation, 2)

                history_data = schemas.PriceHistoryCreate(
                    produce_id=produce.id,
                    market_id=market.id,
                    price=price,
                    date=current_date
                )

                db_history = crud.create_price_history(db, history_data)
                created_history.append(db_history)

        current_date += timedelta(days=1)

    logger.info(f"Created {len(created_history)} price history entries")
    return created_history


def main():
    """Main function to seed the database."""
    logger.info("Starting database seeding...")

    # Initialize database
    init_db()

    # Create session
    db = SessionLocal()

    try:
        # Seed data in order
        categories = seed_categories(db)
        markets = seed_markets(db)
        produce_items = seed_produce_items(db, categories)
        prices = seed_prices(db, produce_items, markets)
        price_history = seed_price_history(db, produce_items, markets)

        logger.info("Database seeding completed successfully!")
        logger.info(f"Created:")
        logger.info(f"  - {len(categories)} categories")
        logger.info(f"  - {len(markets)} markets")
        logger.info(f"  - {len(produce_items)} produce items")
        logger.info(f"  - {len(prices)} current prices")
        logger.info(f"  - {len(price_history)} price history records")

    except Exception as e:
        logger.error(f"Error seeding database: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
