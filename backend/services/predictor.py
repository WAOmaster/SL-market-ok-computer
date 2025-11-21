"""Price prediction service using machine learning."""
import logging
from typing import List, Dict
from datetime import datetime, timedelta, date
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score
import models
import schemas

logger = logging.getLogger(__name__)


class PricePredictor:
    """Price prediction service using machine learning models."""

    def __init__(self):
        """Initialize the predictor."""
        self.model = None
        self.scaler = StandardScaler()

    def predict_prices(
        self,
        price_history: List[models.PriceHistory],
        days: int = 7
    ) -> Dict:
        """
        Predict future prices based on historical data.

        Args:
            price_history: List of historical price records
            days: Number of days to predict

        Returns:
            Dictionary containing predictions and model metrics
        """
        if len(price_history) < 7:
            raise ValueError("Need at least 7 days of historical data for predictions")

        # Convert to pandas DataFrame
        df = pd.DataFrame([
            {
                "date": record.date,
                "price": record.price
            }
            for record in price_history
        ])

        df = df.sort_values("date")
        df["date"] = pd.to_datetime(df["date"])

        # Prepare features
        df["days_since_start"] = (df["date"] - df["date"].min()).dt.days
        df["day_of_week"] = df["date"].dt.dayofweek
        df["day_of_month"] = df["date"].dt.day
        df["month"] = df["date"].dt.month

        # Prepare training data
        X = df[["days_since_start", "day_of_week", "day_of_month", "month"]].values
        y = df["price"].values

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Train model
        self.model = LinearRegression()
        self.model.fit(X_scaled, y)

        # Calculate model accuracy
        y_pred_train = self.model.predict(X_scaled)
        mae = mean_absolute_error(y, y_pred_train)
        r2 = r2_score(y, y_pred_train)
        accuracy = max(0, min(100, (1 - mae / np.mean(y)) * 100))

        # Generate predictions
        last_date = df["date"].max()
        predictions = []

        for i in range(1, days + 1):
            pred_date = last_date + timedelta(days=i)
            days_since_start = (pred_date - df["date"].min()).days
            day_of_week = pred_date.dayofweek
            day_of_month = pred_date.day
            month = pred_date.month

            X_pred = np.array([[days_since_start, day_of_week, day_of_month, month]])
            X_pred_scaled = self.scaler.transform(X_pred)

            predicted_price = self.model.predict(X_pred_scaled)[0]

            # Calculate confidence interval (simple approach using historical std)
            price_std = np.std(y)
            confidence_interval = 1.96 * price_std  # 95% confidence

            predictions.append(
                schemas.PricePrediction(
                    date=pred_date.date(),
                    predicted_price=round(predicted_price, 2),
                    confidence_interval_lower=round(max(0, predicted_price - confidence_interval), 2),
                    confidence_interval_upper=round(predicted_price + confidence_interval, 2)
                )
            )

        return {
            "predictions": predictions,
            "accuracy": round(accuracy, 2),
            "mae": round(mae, 2),
            "r2": round(r2, 4)
        }

    def detect_seasonal_patterns(
        self,
        price_history: List[models.PriceHistory]
    ) -> Dict:
        """
        Detect seasonal patterns in price data.

        Args:
            price_history: List of historical price records

        Returns:
            Dictionary containing seasonal pattern information
        """
        if len(price_history) < 30:
            return {
                "has_pattern": False,
                "message": "Insufficient data for seasonal analysis"
            }

        # Convert to DataFrame
        df = pd.DataFrame([
            {
                "date": record.date,
                "price": record.price
            }
            for record in price_history
        ])

        df = df.sort_values("date")
        df["date"] = pd.to_datetime(df["date"])
        df["month"] = df["date"].dt.month
        df["day_of_week"] = df["date"].dt.dayofweek

        # Analyze monthly patterns
        monthly_avg = df.groupby("month")["price"].mean().to_dict()
        monthly_std = df.groupby("month")["price"].std().to_dict()

        # Analyze weekly patterns
        weekly_avg = df.groupby("day_of_week")["price"].mean().to_dict()

        # Determine if there's a significant pattern
        overall_std = df["price"].std()
        monthly_variation = np.std(list(monthly_avg.values()))

        has_pattern = monthly_variation > (overall_std * 0.3)

        return {
            "has_pattern": has_pattern,
            "monthly_average": {
                k: round(v, 2) for k, v in monthly_avg.items()
            },
            "monthly_std": {
                k: round(v, 2) for k, v in monthly_std.items()
            },
            "weekly_average": {
                k: round(v, 2) for k, v in weekly_avg.items()
            },
            "overall_variation": round(overall_std, 2)
        }

    def predict_with_prophet(
        self,
        price_history: List[models.PriceHistory],
        days: int = 7
    ) -> Dict:
        """
        Predict prices using Facebook Prophet (advanced method).

        Note: This requires prophet to be installed.
        Falls back to linear regression if Prophet is not available.

        Args:
            price_history: List of historical price records
            days: Number of days to predict

        Returns:
            Dictionary containing predictions and metrics
        """
        try:
            from prophet import Prophet

            # Prepare data for Prophet
            df = pd.DataFrame([
                {
                    "ds": record.date,
                    "y": record.price
                }
                for record in price_history
            ])

            # Initialize and fit model
            model = Prophet(
                daily_seasonality=True,
                weekly_seasonality=True,
                yearly_seasonality=False
            )
            model.fit(df)

            # Create future dataframe
            future = model.make_future_dataframe(periods=days)
            forecast = model.predict(future)

            # Extract predictions
            predictions = []
            last_date = df["ds"].max()

            for i in range(1, days + 1):
                pred_date = last_date + timedelta(days=i)
                forecast_row = forecast[forecast["ds"] == pred_date].iloc[0]

                predictions.append(
                    schemas.PricePrediction(
                        date=pred_date.date(),
                        predicted_price=round(forecast_row["yhat"], 2),
                        confidence_interval_lower=round(forecast_row["yhat_lower"], 2),
                        confidence_interval_upper=round(forecast_row["yhat_upper"], 2)
                    )
                )

            return {
                "predictions": predictions,
                "model": "Prophet",
                "accuracy": None  # Prophet doesn't provide simple accuracy metric
            }

        except ImportError:
            logger.warning("Prophet not available, falling back to linear regression")
            return self.predict_prices(price_history, days)
        except Exception as e:
            logger.error(f"Error in Prophet prediction: {str(e)}")
            return self.predict_prices(price_history, days)
