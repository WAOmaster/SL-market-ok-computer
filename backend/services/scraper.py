"""Web scraper service for collecting market prices from Sri Lankan sources."""
import logging
import time
from typing import List, Dict, Optional
from datetime import datetime, date
import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from sqlalchemy.orm import Session
import crud
import schemas

logger = logging.getLogger(__name__)


class MarketPriceScraper:
    """Scraper for collecting market prices from various Sri Lankan sources."""

    def __init__(self):
        """Initialize the scraper."""
        self.sources = [
            {
                "name": "Department of Census and Statistics",
                "url": "http://www.statistics.gov.lk/",
                "scraper": self._scrape_dcs
            },
            {
                "name": "Hector Kobbekaduwa Agrarian Research",
                "url": "https://www.harti.gov.lk/",
                "scraper": self._scrape_harti
            }
        ]

    def scrape_all_sources(self, db: Session) -> Dict[str, int]:
        """
        Scrape prices from all configured sources.

        Args:
            db: Database session

        Returns:
            Dictionary with statistics about scraped data
        """
        stats = {
            "total_prices": 0,
            "successful_sources": 0,
            "failed_sources": 0,
            "errors": []
        }

        for source in self.sources:
            try:
                logger.info(f"Scraping {source['name']}...")
                prices = source["scraper"](db)
                stats["total_prices"] += len(prices)
                stats["successful_sources"] += 1
                logger.info(f"Successfully scraped {len(prices)} prices from {source['name']}")
            except Exception as e:
                logger.error(f"Error scraping {source['name']}: {str(e)}")
                stats["failed_sources"] += 1
                stats["errors"].append({
                    "source": source["name"],
                    "error": str(e)
                })

        return stats

    def _scrape_dcs(self, db: Session) -> List[dict]:
        """
        Scrape prices from Department of Census and Statistics.

        This is a placeholder implementation. In production, you would
        implement the actual scraping logic based on the website structure.

        Args:
            db: Database session

        Returns:
            List of price dictionaries
        """
        prices = []

        try:
            # Example implementation - replace with actual scraping logic
            # For demonstration, we'll use sample data
            sample_prices = self._get_sample_prices(db)

            for price_data in sample_prices:
                # Update or create price in database
                price = crud.update_or_create_price(
                    db,
                    produce_id=price_data["produce_id"],
                    market_id=price_data["market_id"],
                    price=price_data["price"],
                    source="DCS"
                )

                # Also add to price history
                history_data = schemas.PriceHistoryCreate(
                    produce_id=price_data["produce_id"],
                    market_id=price_data["market_id"],
                    price=price_data["price"],
                    date=date.today()
                )
                crud.create_price_history(db, history_data)

                prices.append(price_data)

        except Exception as e:
            logger.error(f"Error in DCS scraper: {str(e)}")
            raise

        return prices

    def _scrape_harti(self, db: Session) -> List[dict]:
        """
        Scrape prices from HARTI website.

        This is a placeholder implementation. In production, you would
        implement the actual scraping logic based on the website structure.

        Args:
            db: Database session

        Returns:
            List of price dictionaries
        """
        prices = []

        try:
            # Placeholder - implement actual scraping logic
            # For now, return empty list
            pass

        except Exception as e:
            logger.error(f"Error in HARTI scraper: {str(e)}")
            raise

        return prices

    def _get_sample_prices(self, db: Session) -> List[dict]:
        """
        Generate sample price data for demonstration.

        In production, replace this with actual scraping logic.

        Args:
            db: Database session

        Returns:
            List of sample price dictionaries
        """
        import random

        sample_prices = []

        # Get all produce items and markets
        produce_items = crud.get_produce_items(db, limit=100)
        markets = crud.get_markets(db, limit=100)

        if not produce_items or not markets:
            return sample_prices

        # Generate sample prices for random produce-market combinations
        for produce in produce_items[:10]:  # First 10 produce items
            for market in markets[:3]:  # First 3 markets
                # Generate random price variation (base price * random factor)
                base_price = random.uniform(50, 500)
                variation = random.uniform(0.8, 1.2)
                price = round(base_price * variation, 2)

                sample_prices.append({
                    "produce_id": produce.id,
                    "market_id": market.id,
                    "price": price
                })

        return sample_prices

    def scrape_with_selenium(self, url: str, wait_for_selector: str = None) -> BeautifulSoup:
        """
        Scrape a webpage using Selenium for JavaScript-heavy sites.

        Args:
            url: URL to scrape
            wait_for_selector: CSS selector to wait for before scraping

        Returns:
            BeautifulSoup object of the page
        """
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")

        driver = webdriver.Chrome(options=chrome_options)

        try:
            driver.get(url)

            if wait_for_selector:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, wait_for_selector))
                )

            page_source = driver.page_source
            soup = BeautifulSoup(page_source, 'html.parser')
            return soup

        finally:
            driver.quit()

    def scrape_with_requests(self, url: str, headers: dict = None) -> BeautifulSoup:
        """
        Scrape a webpage using requests for static sites.

        Args:
            url: URL to scrape
            headers: Optional HTTP headers

        Returns:
            BeautifulSoup object of the page
        """
        if headers is None:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')
        return soup


def run_scheduled_scraping(db: Session):
    """
    Run scheduled scraping job.

    This function is called by the scheduler to scrape prices periodically.

    Args:
        db: Database session
    """
    logger.info("Starting scheduled price scraping...")
    scraper = MarketPriceScraper()

    try:
        stats = scraper.scrape_all_sources(db)
        logger.info(f"Scraping completed. Stats: {stats}")
        return stats
    except Exception as e:
        logger.error(f"Error in scheduled scraping: {str(e)}")
        raise
