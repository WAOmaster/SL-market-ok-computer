"""Route optimization service for shopping lists."""
import logging
from typing import List, Dict, Tuple, Optional
import networkx as nx
from geopy.distance import geodesic
import models
import schemas

logger = logging.getLogger(__name__)


class RouteOptimizer:
    """Optimize shopping routes across multiple markets."""

    def __init__(self):
        """Initialize the optimizer."""
        self.graph = None

    def optimize_route(
        self,
        shopping_list: models.ShoppingList,
        markets: List[models.Market],
        price_data: Dict,
        start_location: Tuple[float, float]
    ) -> Optional[schemas.OptimizedRoute]:
        """
        Optimize shopping route to minimize cost and distance.

        Args:
            shopping_list: Shopping list with items to purchase
            markets: List of available markets
            price_data: Price comparison data for all items
            start_location: Starting location (latitude, longitude)

        Returns:
            OptimizedRoute object with optimized shopping plan
        """
        try:
            # Build assignment of items to markets (cheapest market for each item)
            market_assignments = self._assign_items_to_markets(
                shopping_list,
                price_data
            )

            if not market_assignments:
                logger.warning("No market assignments found")
                return None

            # Calculate total cost and organize by market
            market_stops = []
            total_cost = 0

            for market_id, items in market_assignments.items():
                market = next((m for m in markets if m.id == market_id), None)
                if not market:
                    continue

                # Calculate cost for this market
                market_cost = sum(item["total_price"] for item in items)
                total_cost += market_cost

                market_stops.append({
                    "market_id": market.id,
                    "market_name": market.name,
                    "latitude": market.latitude,
                    "longitude": market.longitude,
                    "items": items,
                    "estimated_cost": round(market_cost, 2)
                })

            # Optimize route order using nearest neighbor algorithm
            ordered_stops = self._optimize_route_order(
                market_stops,
                start_location
            )

            # Calculate total distance
            total_distance = self._calculate_total_distance(
                ordered_stops,
                start_location
            )

            # Calculate savings vs single market
            single_market_cost = self._calculate_single_market_cost(
                shopping_list,
                markets,
                price_data
            )

            savings = single_market_cost - total_cost if single_market_cost else None

            # Build response
            route_stops = []
            for i, stop in enumerate(ordered_stops):
                route_stops.append(
                    schemas.MarketStop(
                        market_id=stop["market_id"],
                        market_name=stop["market_name"],
                        latitude=stop.get("latitude"),
                        longitude=stop.get("longitude"),
                        items=stop["items"],
                        estimated_cost=stop["estimated_cost"],
                        order=i + 1
                    )
                )

            return schemas.OptimizedRoute(
                shopping_list_id=shopping_list.id,
                total_estimated_cost=round(total_cost, 2),
                total_distance_km=round(total_distance, 2) if total_distance else None,
                route=route_stops,
                savings_vs_single_market=round(savings, 2) if savings else None
            )

        except Exception as e:
            logger.error(f"Error optimizing route: {str(e)}")
            return None

    def _assign_items_to_markets(
        self,
        shopping_list: models.ShoppingList,
        price_data: Dict
    ) -> Dict[int, List[Dict]]:
        """
        Assign each shopping list item to the cheapest market.

        Args:
            shopping_list: Shopping list
            price_data: Price comparison data

        Returns:
            Dictionary mapping market_id to list of items
        """
        assignments = {}

        for item in shopping_list.items:
            produce_id = item.produce_id
            quantity = item.quantity

            # Find cheapest market for this item
            if produce_id not in price_data:
                logger.warning(f"No price data for produce_id {produce_id}")
                continue

            prices = price_data[produce_id]["prices"]
            if not prices:
                continue

            # Find minimum price
            cheapest = min(prices, key=lambda x: x["price"])
            market_id = cheapest["market_id"]
            unit_price = cheapest["price"]
            total_price = unit_price * quantity

            if market_id not in assignments:
                assignments[market_id] = []

            assignments[market_id].append({
                "produce_id": produce_id,
                "produce_name": price_data[produce_id]["produce_name"],
                "quantity": quantity,
                "unit": price_data[produce_id]["unit"],
                "unit_price": unit_price,
                "total_price": total_price
            })

        return assignments

    def _optimize_route_order(
        self,
        market_stops: List[Dict],
        start_location: Tuple[float, float]
    ) -> List[Dict]:
        """
        Optimize the order of market visits using nearest neighbor algorithm.

        Args:
            market_stops: List of market stop dictionaries
            start_location: Starting location (latitude, longitude)

        Returns:
            Ordered list of market stops
        """
        if not market_stops:
            return []

        # Filter markets with valid coordinates
        valid_stops = [
            s for s in market_stops
            if s.get("latitude") and s.get("longitude")
        ]

        if not valid_stops:
            # Return original order if no coordinates
            return market_stops

        # Nearest neighbor algorithm
        ordered = []
        current_location = start_location
        remaining = valid_stops.copy()

        while remaining:
            # Find nearest market
            nearest = min(
                remaining,
                key=lambda m: geodesic(
                    current_location,
                    (m["latitude"], m["longitude"])
                ).kilometers
            )

            ordered.append(nearest)
            remaining.remove(nearest)
            current_location = (nearest["latitude"], nearest["longitude"])

        # Add any stops without coordinates at the end
        invalid_stops = [s for s in market_stops if s not in valid_stops]
        ordered.extend(invalid_stops)

        return ordered

    def _calculate_total_distance(
        self,
        ordered_stops: List[Dict],
        start_location: Tuple[float, float]
    ) -> Optional[float]:
        """
        Calculate total distance for the route.

        Args:
            ordered_stops: Ordered list of market stops
            start_location: Starting location

        Returns:
            Total distance in kilometers
        """
        if not ordered_stops:
            return None

        total_distance = 0
        current_location = start_location

        for stop in ordered_stops:
            if stop.get("latitude") and stop.get("longitude"):
                next_location = (stop["latitude"], stop["longitude"])
                distance = geodesic(current_location, next_location).kilometers
                total_distance += distance
                current_location = next_location

        return total_distance

    def _calculate_single_market_cost(
        self,
        shopping_list: models.ShoppingList,
        markets: List[models.Market],
        price_data: Dict
    ) -> Optional[float]:
        """
        Calculate cost if shopping at a single market.

        Returns the cost at the market that would be most economical
        if buying all items there.

        Args:
            shopping_list: Shopping list
            markets: List of markets
            price_data: Price comparison data

        Returns:
            Minimum single-market cost
        """
        market_costs = {}

        for market in markets:
            total_cost = 0
            all_items_available = True

            for item in shopping_list.items:
                produce_id = item.produce_id
                quantity = item.quantity

                if produce_id not in price_data:
                    all_items_available = False
                    break

                # Find price at this market
                market_price = next(
                    (p["price"] for p in price_data[produce_id]["prices"]
                     if p["market_id"] == market.id),
                    None
                )

                if market_price is None:
                    all_items_available = False
                    break

                total_cost += market_price * quantity

            if all_items_available:
                market_costs[market.id] = total_cost

        if not market_costs:
            return None

        return min(market_costs.values())

    def optimize_with_tsp(
        self,
        market_stops: List[Dict],
        start_location: Tuple[float, float]
    ) -> List[Dict]:
        """
        Optimize route using Traveling Salesman Problem solver.

        This is a more advanced optimization using NetworkX.

        Args:
            market_stops: List of market stop dictionaries
            start_location: Starting location

        Returns:
            Optimized order of market stops
        """
        if len(market_stops) <= 1:
            return market_stops

        # Filter valid coordinates
        valid_stops = [
            s for s in market_stops
            if s.get("latitude") and s.get("longitude")
        ]

        if len(valid_stops) <= 1:
            return market_stops

        # Build complete graph with distances
        G = nx.Graph()

        # Add start node
        G.add_node("start", pos=start_location)

        # Add market nodes
        for i, stop in enumerate(valid_stops):
            node_id = f"market_{i}"
            G.add_node(node_id, pos=(stop["latitude"], stop["longitude"]))

        # Add edges with distances
        nodes = list(G.nodes())
        for i, node1 in enumerate(nodes):
            for node2 in nodes[i + 1:]:
                pos1 = G.nodes[node1]["pos"]
                pos2 = G.nodes[node2]["pos"]
                distance = geodesic(pos1, pos2).kilometers
                G.add_edge(node1, node2, weight=distance)

        # Use approximation algorithm for TSP
        try:
            tsp_path = nx.approximation.traveling_salesman_problem(
                G,
                cycle=False,
                weight="weight"
            )

            # Convert back to market stops
            ordered_stops = []
            for node in tsp_path:
                if node.startswith("market_"):
                    idx = int(node.split("_")[1])
                    ordered_stops.append(valid_stops[idx])

            return ordered_stops

        except Exception as e:
            logger.error(f"Error in TSP optimization: {str(e)}")
            # Fallback to nearest neighbor
            return self._optimize_route_order(market_stops, start_location)
