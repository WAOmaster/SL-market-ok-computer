/**
 * API Client for Sri Lanka Market Price App
 * Handles all API requests to the backend server
 */

const API_BASE_URL = 'http://localhost:8000';

class MarketPriceAPI {
    constructor(baseURL = API_BASE_URL) {
        this.baseURL = baseURL;
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async fetchAPI(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // ========== Categories ==========
    async getCategories(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetchAPI(`/api/categories${queryString ? '?' + queryString : ''}`);
    }

    async createCategory(data) {
        return this.fetchAPI('/api/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // ========== Markets ==========
    async getMarkets(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetchAPI(`/api/markets/${queryString ? '?' + queryString : ''}`);
    }

    async getMarket(marketId) {
        return this.fetchAPI(`/api/markets/${marketId}`);
    }

    async createMarket(data) {
        return this.fetchAPI('/api/markets/', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateMarket(marketId, data) {
        return this.fetchAPI(`/api/markets/${marketId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // ========== Produce ==========
    async getProduce(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetchAPI(`/api/produce/${queryString ? '?' + queryString : ''}`);
    }

    async getProduceById(produceId) {
        return this.fetchAPI(`/api/produce/${produceId}`);
    }

    async createProduce(data) {
        return this.fetchAPI('/api/produce/', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateProduce(produceId, data) {
        return this.fetchAPI(`/api/produce/${produceId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // ========== Prices ==========
    async getPrices(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetchAPI(`/api/prices/${queryString ? '?' + queryString : ''}`);
    }

    async getPrice(priceId) {
        return this.fetchAPI(`/api/prices/${priceId}`);
    }

    async comparePrices(produceIds, marketIds = null) {
        const params = new URLSearchParams();
        produceIds.forEach(id => params.append('produce_ids', id));
        if (marketIds) {
            marketIds.forEach(id => params.append('market_ids', id));
        }
        return this.fetchAPI(`/api/prices/compare/?${params.toString()}`);
    }

    async getPriceHistory(produceId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetchAPI(`/api/prices/history/${produceId}${queryString ? '?' + queryString : ''}`);
    }

    // ========== Predictions ==========
    async getPricePredictions(produceId, days = 7) {
        return this.fetchAPI(`/api/predictions/${produceId}?days=${days}`);
    }

    // ========== Shopping Lists ==========
    async getShoppingLists(userId, params = {}) {
        const queryString = new URLSearchParams({ user_id: userId, ...params }).toString();
        return this.fetchAPI(`/api/shopping/lists?${queryString}`);
    }

    async createShoppingList(data) {
        return this.fetchAPI('/api/shopping/lists', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getShoppingList(listId) {
        return this.fetchAPI(`/api/shopping/lists/${listId}`);
    }

    async updateShoppingList(listId, data) {
        return this.fetchAPI(`/api/shopping/lists/${listId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteShoppingList(listId) {
        return this.fetchAPI(`/api/shopping/lists/${listId}`, {
            method: 'DELETE'
        });
    }

    async optimizeShoppingRoute(listId, startLat, startLng) {
        return this.fetchAPI(
            `/api/shopping/lists/${listId}/optimize?start_latitude=${startLat}&start_longitude=${startLng}`
        );
    }

    // ========== Price Alerts ==========
    async getPriceAlerts(userId, params = {}) {
        const queryString = new URLSearchParams({ user_id: userId, ...params }).toString();
        return this.fetchAPI(`/api/shopping/alerts?${queryString}`);
    }

    async createPriceAlert(data) {
        return this.fetchAPI('/api/shopping/alerts', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async deactivatePriceAlert(alertId) {
        return this.fetchAPI(`/api/shopping/alerts/${alertId}/deactivate`, {
            method: 'POST'
        });
    }

    // ========== Health Check ==========
    async healthCheck() {
        return this.fetchAPI('/health');
    }

    // ========== Helper Methods ==========

    /**
     * Search produce by name (supports multilingual search)
     */
    async searchProduce(query, limit = 10) {
        return this.getProduce({ search: query, limit });
    }

    /**
     * Get current prices for a specific market
     */
    async getMarketPrices(marketId, params = {}) {
        return this.getPrices({ market_id: marketId, ...params });
    }

    /**
     * Get all prices for a specific produce item
     */
    async getProducePrices(produceId, params = {}) {
        return this.getPrices({ produce_id: produceId, ...params });
    }

    /**
     * Get cheapest price for a produce item across all markets
     */
    async getCheapestPrice(produceId) {
        const prices = await this.getProducePrices(produceId, { limit: 1000 });
        if (prices.length === 0) return null;

        return prices.reduce((cheapest, current) =>
            current.price < cheapest.price ? current : cheapest
        );
    }

    /**
     * Calculate total cost for a shopping list
     */
    async calculateShoppingListCost(items) {
        let total = 0;
        for (const item of items) {
            try {
                const cheapest = await this.getCheapestPrice(item.produce_id);
                if (cheapest) {
                    total += cheapest.price * item.quantity;
                }
            } catch (error) {
                console.error(`Error calculating cost for produce ${item.produce_id}:`, error);
            }
        }
        return total;
    }
}

// Create singleton instance
const api = new MarketPriceAPI();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MarketPriceAPI, api };
}
