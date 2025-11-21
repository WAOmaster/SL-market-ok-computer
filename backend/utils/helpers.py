"""Helper functions and utilities."""
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import hashlib

logger = logging.getLogger(__name__)


def format_price(price: float, currency: str = "LKR") -> str:
    """
    Format price with currency symbol.

    Args:
        price: Price value
        currency: Currency code

    Returns:
        Formatted price string
    """
    currency_symbols = {
        "LKR": "Rs. ",
        "USD": "$",
        "EUR": "€",
        "GBP": "£"
    }

    symbol = currency_symbols.get(currency, currency + " ")
    return f"{symbol}{price:,.2f}"


def calculate_price_change(current_price: float, previous_price: float) -> Dict[str, Any]:
    """
    Calculate price change percentage and direction.

    Args:
        current_price: Current price
        previous_price: Previous price

    Returns:
        Dictionary with change amount, percentage, and direction
    """
    if previous_price == 0:
        return {
            "amount": 0,
            "percentage": 0,
            "direction": "stable"
        }

    change_amount = current_price - previous_price
    change_percentage = (change_amount / previous_price) * 100

    direction = "stable"
    if change_percentage > 0:
        direction = "up"
    elif change_percentage < 0:
        direction = "down"

    return {
        "amount": round(change_amount, 2),
        "percentage": round(change_percentage, 2),
        "direction": direction
    }


def validate_coordinates(latitude: float, longitude: float) -> bool:
    """
    Validate GPS coordinates.

    Args:
        latitude: Latitude value
        longitude: Longitude value

    Returns:
        True if valid, False otherwise
    """
    if not (-90 <= latitude <= 90):
        return False
    if not (-180 <= longitude <= 180):
        return False
    return True


def generate_cache_key(*args, **kwargs) -> str:
    """
    Generate a cache key from arguments.

    Args:
        *args: Positional arguments
        **kwargs: Keyword arguments

    Returns:
        Cache key string
    """
    key_parts = [str(arg) for arg in args]
    key_parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
    key_string = ":".join(key_parts)

    # Hash for consistent length
    return hashlib.md5(key_string.encode()).hexdigest()


def parse_date_range(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    default_days: int = 30
) -> tuple:
    """
    Parse date range strings into datetime objects.

    Args:
        start_date: Start date string (ISO format)
        end_date: End date string (ISO format)
        default_days: Default number of days if not specified

    Returns:
        Tuple of (start_date, end_date) as datetime objects
    """
    end = datetime.now()
    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
        except ValueError:
            logger.warning(f"Invalid end_date format: {end_date}")

    start = end - timedelta(days=default_days)
    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
        except ValueError:
            logger.warning(f"Invalid start_date format: {start_date}")

    return start, end


def sanitize_string(text: str, max_length: int = 255) -> str:
    """
    Sanitize string input.

    Args:
        text: Input text
        max_length: Maximum allowed length

    Returns:
        Sanitized string
    """
    if not text:
        return ""

    # Remove leading/trailing whitespace
    text = text.strip()

    # Truncate to max length
    if len(text) > max_length:
        text = text[:max_length]

    return text


def convert_unit(
    value: float,
    from_unit: str,
    to_unit: str
) -> Optional[float]:
    """
    Convert between different units of measurement.

    Args:
        value: Value to convert
        from_unit: Source unit
        to_unit: Target unit

    Returns:
        Converted value or None if conversion not supported
    """
    # Weight conversions
    weight_conversions = {
        ("kg", "g"): 1000,
        ("g", "kg"): 0.001,
        ("kg", "lb"): 2.20462,
        ("lb", "kg"): 0.453592,
        ("g", "oz"): 0.035274,
        ("oz", "g"): 28.3495
    }

    # Volume conversions
    volume_conversions = {
        ("l", "ml"): 1000,
        ("ml", "l"): 0.001,
        ("l", "gal"): 0.264172,
        ("gal", "l"): 3.78541
    }

    all_conversions = {**weight_conversions, **volume_conversions}

    # Normalize units
    from_unit = from_unit.lower()
    to_unit = to_unit.lower()

    if from_unit == to_unit:
        return value

    conversion_key = (from_unit, to_unit)
    if conversion_key in all_conversions:
        return value * all_conversions[conversion_key]

    logger.warning(f"Conversion from {from_unit} to {to_unit} not supported")
    return None


def calculate_average(values: list) -> Optional[float]:
    """
    Calculate average of a list of values.

    Args:
        values: List of numeric values

    Returns:
        Average value or None if empty list
    """
    if not values:
        return None

    return sum(values) / len(values)


def get_price_trend(prices: list) -> str:
    """
    Determine price trend from a list of prices.

    Args:
        prices: List of price values (chronological order)

    Returns:
        Trend description: "increasing", "decreasing", or "stable"
    """
    if len(prices) < 2:
        return "stable"

    # Calculate average change
    changes = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
    avg_change = sum(changes) / len(changes)

    # Threshold for considering it stable (5% of average price)
    avg_price = sum(prices) / len(prices)
    threshold = avg_price * 0.05

    if avg_change > threshold:
        return "increasing"
    elif avg_change < -threshold:
        return "decreasing"
    else:
        return "stable"


def format_timestamp(dt: datetime, format_type: str = "iso") -> str:
    """
    Format datetime object to string.

    Args:
        dt: Datetime object
        format_type: Format type ("iso", "date", "datetime", "relative")

    Returns:
        Formatted datetime string
    """
    if format_type == "iso":
        return dt.isoformat()
    elif format_type == "date":
        return dt.strftime("%Y-%m-%d")
    elif format_type == "datetime":
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    elif format_type == "relative":
        delta = datetime.now() - dt
        if delta.days > 0:
            return f"{delta.days} days ago"
        elif delta.seconds > 3600:
            hours = delta.seconds // 3600
            return f"{hours} hours ago"
        elif delta.seconds > 60:
            minutes = delta.seconds // 60
            return f"{minutes} minutes ago"
        else:
            return "just now"
    else:
        return dt.isoformat()


def chunk_list(items: list, chunk_size: int) -> list:
    """
    Split a list into chunks of specified size.

    Args:
        items: List to chunk
        chunk_size: Size of each chunk

    Returns:
        List of chunks
    """
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]
