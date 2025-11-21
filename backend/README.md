# Sri Lanka Market Price API - Backend

Production-ready FastAPI backend for tracking and predicting market prices across Sri Lankan produce markets.

## Features

- **Real-time Price Tracking**: Track current prices for produce items across multiple markets
- **Historical Data**: Maintain price history for trend analysis
- **Price Predictions**: Machine learning-based price forecasting (7-day predictions)
- **Route Optimization**: Calculate optimal shopping routes to minimize cost and distance
- **Price Alerts**: User price alerts for specific produce items
- **Shopping Lists**: Create and manage shopping lists with budget tracking
- **Multi-language Support**: English, Sinhala, and Tamil translations
- **Web Scraping**: Automated price collection from Sri Lankan market sources
- **RESTful API**: Comprehensive REST API with automatic documentation

## Tech Stack

- **Framework**: FastAPI 0.104+
- **Database**: SQLAlchemy ORM (SQLite for development, PostgreSQL for production)
- **Validation**: Pydantic v2
- **Machine Learning**: scikit-learn, Prophet (optional)
- **Web Scraping**: BeautifulSoup4, Selenium
- **Route Optimization**: NetworkX, Geopy
- **Scheduling**: APScheduler
- **Testing**: Pytest, httpx

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── config.py              # Configuration settings
├── database.py            # Database setup and session management
├── models.py              # SQLAlchemy database models
├── schemas.py             # Pydantic validation schemas
├── crud.py                # Database CRUD operations
├── seed_data.py           # Database seeding script
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── routers/              # API route handlers
│   ├── __init__.py
│   ├── prices.py         # Price endpoints
│   ├── produce.py        # Produce item endpoints
│   ├── markets.py        # Market endpoints
│   ├── predictions.py    # Price prediction endpoints
│   └── shopping.py       # Shopping list & alerts
├── services/             # Business logic services
│   ├── __init__.py
│   ├── scraper.py        # Web scraping service
│   ├── predictor.py      # Price prediction ML service
│   └── optimizer.py      # Route optimization service
├── utils/                # Utility functions
│   ├── __init__.py
│   └── helpers.py        # Helper functions
└── tests/                # Test suite
    ├── __init__.py
    ├── test_api.py       # API endpoint tests
    └── test_services.py  # Service layer tests
```

## Installation

### Prerequisites

- Python 3.9 or higher
- pip package manager
- Virtual environment (recommended)

### Setup

1. **Clone the repository**:
```bash
cd /home/user/SL-market-ok-computer/backend
```

2. **Create virtual environment**:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Initialize database**:
```bash
python seed_data.py
```

This will create the database and populate it with sample data including:
- 7 categories
- 5 markets across Sri Lanka
- 22 produce items
- Current prices and 60 days of historical data

## Running the Application

### Development Mode

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## API Endpoints

### Core Endpoints

#### Prices
- `GET /api/prices` - List all current prices (with filters)
- `GET /api/prices/{id}` - Get specific price
- `POST /api/prices` - Create new price entry
- `GET /api/prices/compare` - Compare prices across markets
- `GET /api/prices/history/{produce_id}` - Get price history

#### Produce Items
- `GET /api/produce` - List all produce items
- `GET /api/produce/{id}` - Get specific produce item
- `POST /api/produce` - Create new produce item

#### Markets
- `GET /api/markets` - List all markets
- `GET /api/markets/{id}` - Get specific market
- `POST /api/markets` - Create new market

#### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create new category

#### Predictions
- `GET /api/predictions/{produce_id}` - Get price predictions (7-day forecast)

#### Shopping Lists
- `GET /api/shopping/lists?user_id={id}` - List user's shopping lists
- `GET /api/shopping/lists/{id}` - Get specific shopping list
- `POST /api/shopping/lists` - Create shopping list
- `DELETE /api/shopping/lists/{id}` - Delete shopping list
- `GET /api/shopping/lists/{id}/optimize` - Get optimized shopping route

#### Price Alerts
- `GET /api/shopping/alerts?user_id={id}` - List user's price alerts
- `POST /api/shopping/alerts` - Create price alert
- `PATCH /api/shopping/alerts/{id}/deactivate` - Deactivate alert

### Health & Info
- `GET /` - API information
- `GET /health` - Health check

## Usage Examples

### Get Current Prices

```bash
curl "http://localhost:8000/api/prices?limit=10"
```

### Compare Prices Across Markets

```bash
curl "http://localhost:8000/api/prices/compare?produce_ids=1,2,3&market_ids=1,2"
```

### Get Price Predictions

```bash
curl "http://localhost:8000/api/predictions/1?days=7"
```

### Create Shopping List

```bash
curl -X POST "http://localhost:8000/api/shopping/lists" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "name": "Weekly Groceries",
    "budget": 5000,
    "items": [
      {"produce_id": 1, "quantity": 2, "unit": "kg"},
      {"produce_id": 2, "quantity": 3, "unit": "kg"}
    ]
  }'
```

### Optimize Shopping Route

```bash
curl "http://localhost:8000/api/shopping/lists/1/optimize?start_latitude=6.9271&start_longitude=79.8612"
```

## Machine Learning Features

### Price Prediction

The system uses machine learning to predict future prices based on historical data:

- **Model**: Linear Regression with seasonal features
- **Features**: Days since start, day of week, day of month, month
- **Fallback**: Prophet model (if installed) for advanced time series analysis
- **Accuracy**: Reported with each prediction
- **Requirements**: Minimum 7 days of historical data

### Route Optimization

Optimizes shopping routes using graph algorithms:

- **Algorithm**: Nearest Neighbor with optional TSP solver
- **Optimization**: Minimizes total cost and distance
- **Features**:
  - Assigns items to cheapest markets
  - Calculates optimal visit order
  - Estimates total distance
  - Reports savings vs single-market shopping

## Web Scraping

Automated price collection from Sri Lankan market sources:

- **Scheduler**: Runs every 6 hours (configurable)
- **Sources**:
  - Department of Census and Statistics
  - HARTI (Hector Kobbekaduwa Agrarian Research)
  - Extensible for additional sources
- **Features**:
  - Automatic retry logic
  - Error handling and logging
  - Historical data archival

### Adding New Scrapers

1. Add source configuration to `services/scraper.py`
2. Implement scraper method following the pattern
3. Configure in `config.py` if needed

## Configuration

Key configuration options in `.env`:

```bash
# Database
DATABASE_URL=sqlite:///./market_prices.db
# For production: postgresql://user:password@localhost/market_prices

# API Settings
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Scraper
SCRAPER_ENABLED=True
SCRAPER_INTERVAL_HOURS=6

# Predictions
PREDICTION_DAYS=7
MIN_HISTORICAL_DAYS=30

# Security
SECRET_KEY=your-secret-key-change-in-production
```

## Testing

### Run All Tests

```bash
pytest
```

### Run Specific Test File

```bash
pytest tests/test_api.py
```

### Run with Coverage

```bash
pytest --cov=. --cov-report=html
```

### Test Categories

- **API Tests** (`test_api.py`): Endpoint functionality, validation, error handling
- **Service Tests** (`test_services.py`): ML predictions, route optimization, business logic

## Database Schema

### Tables

- **categories**: Product categories with multilingual names
- **markets**: Market locations with GPS coordinates
- **produce_items**: Produce items with category relationships
- **prices**: Current prices (latest for each produce-market pair)
- **price_history**: Historical daily prices for trend analysis
- **shopping_lists**: User shopping lists with budget tracking
- **shopping_list_items**: Items in shopping lists
- **price_alerts**: User price alerts with threshold monitoring

### Relationships

- `ProduceItem` belongs to `Category`
- `Price` references `ProduceItem` and `Market`
- `PriceHistory` references `ProduceItem` and `Market`
- `ShoppingList` has many `ShoppingListItem`
- `ShoppingListItem` references `ProduceItem`

## Production Deployment

### Using PostgreSQL

1. Install PostgreSQL
2. Create database:
```bash
createdb market_prices
```

3. Update `.env`:
```bash
DATABASE_URL=postgresql://user:password@localhost/market_prices
```

4. Run migrations (if using Alembic):
```bash
alembic upgrade head
```

### Using Docker (Optional)

Create `Dockerfile`:
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t sl-market-api .
docker run -p 8000:8000 sl-market-api
```

### Environment Variables for Production

- Set `DEBUG=False`
- Use strong `SECRET_KEY`
- Configure PostgreSQL `DATABASE_URL`
- Restrict `CORS_ORIGINS` to your frontend domain
- Set appropriate `RATE_LIMIT_PER_MINUTE`

## Performance Optimization

- **Database Indexing**: Key fields are indexed (produce_id, market_id, timestamps)
- **Query Optimization**: Uses `joinedload` for eager loading relationships
- **Caching**: Redis support included (configure `REDIS_URL`)
- **Connection Pooling**: SQLAlchemy connection pool configured
- **Async Operations**: FastAPI async endpoints where beneficial

## Security

- **Input Validation**: Pydantic schemas validate all input
- **SQL Injection**: Protected via SQLAlchemy ORM
- **CORS**: Configurable origin restrictions
- **Rate Limiting**: Built-in support (configure in settings)
- **Authentication**: JWT support configured (extend as needed)

## Monitoring & Logging

- **Health Check**: `/health` endpoint for monitoring
- **Structured Logging**: Configured logging with levels
- **Scheduler Status**: Included in health check
- **Database Status**: Connection check in health endpoint

## Troubleshooting

### Database Issues

**Error: "no such table"**
```bash
# Reinitialize database
python seed_data.py
```

### Import Errors

**Error: "No module named 'X'"**
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

### Scraper Issues

**Error: Selenium WebDriver not found**
```bash
# Install ChromeDriver
# On Ubuntu:
apt-get install chromium-chromedriver

# On Mac:
brew install --cask chromedriver
```

### Port Already in Use

```bash
# Use different port
uvicorn main:app --port 8001
```

## API Documentation

Full interactive API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Contributing

1. Follow PEP 8 style guidelines
2. Add type hints to all functions
3. Write tests for new features
4. Update documentation

## License

This project is part of the Sri Lanka Market Price Application.

## Support

For issues and questions:
- Check the interactive API docs at `/docs`
- Review test files for usage examples
- Check logs for error details

## Version History

- **1.0.0**: Initial release
  - Core API endpoints
  - Price tracking and history
  - ML-based predictions
  - Route optimization
  - Web scraping framework
  - Comprehensive test suite
