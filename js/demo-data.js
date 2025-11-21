/**
 * Demo Product Data for Sri Lanka Market Price App
 * Used when backend is not available
 */

const DEMO_DATA = {
  categories: [
    { id: 1, name: 'Vegetables', name_sinhala: 'එළවළු', name_tamil: 'காய்கறிகள்', icon: '🥬' },
    { id: 2, name: 'Fruits', name_sinhala: 'පලතුරු', name_tamil: 'பழங்கள்', icon: '🍎' },
    { id: 3, name: 'Rice & Grains', name_sinhala: 'සහල් හා ධාන්‍ය', name_tamil: 'அரிசி மற்றும் தானியங்கள்', icon: '🌾' },
    { id: 4, name: 'Spices', name_sinhala: 'කුළුබඩු', name_tamil: 'மசாலா', icon: '🌶️' },
    { id: 5, name: 'Fish & Seafood', name_sinhala: 'මාළු', name_tamil: 'மீன் மற்றும் கடல் உணவு', icon: '🐟' },
    { id: 6, name: 'Meat & Poultry', name_sinhala: 'මස්', name_tamil: 'இறைச்சி', icon: '🍗' },
    { id: 7, name: 'Dairy', name_sinhala: 'කිරි නිෂ්පාදන', name_tamil: 'பால் பொருட்கள்', icon: '🥛' }
  ],

  markets: [
    { id: 1, name: 'Manning Market', location: 'Colombo', latitude: 6.9271, longitude: 79.8612 },
    { id: 2, name: 'Pettah Market', location: 'Colombo', latitude: 6.935, longitude: 79.8539 },
    { id: 3, name: 'Dambulla Economic Centre', location: 'Dambulla', latitude: 7.8731, longitude: 80.652 },
    { id: 4, name: 'Kandy Municipal Market', location: 'Kandy', latitude: 7.2906, longitude: 80.6337 },
    { id: 5, name: 'Galle Main Market', location: 'Galle', latitude: 6.0535, longitude: 80.221 }
  ],

  produce: [
    { id: 1, name: 'Tomatoes', name_sinhala: 'තක්කාලි', name_tamil: 'தக்காளி', category_id: 1, unit: 'kg', icon: '🍅' },
    { id: 2, name: 'Potatoes', name_sinhala: 'අල', name_tamil: 'உருளைக்கிழங்கு', category_id: 1, unit: 'kg', icon: '🥔' },
    { id: 3, name: 'Onions (Red)', name_sinhala: 'ලූනු (රතු)', name_tamil: 'வெங்காயம்', category_id: 1, unit: 'kg', icon: '🧅' },
    { id: 4, name: 'Carrots', name_sinhala: 'කැරට්', name_tamil: 'கேரட்', category_id: 1, unit: 'kg', icon: '🥕' },
    { id: 5, name: 'Green Beans', name_sinhala: 'බෝංචි', name_tamil: 'பீன்ஸ்', category_id: 1, unit: 'kg', icon: '🫘' },
    { id: 6, name: 'Cabbage', name_sinhala: 'ගෝවා', name_tamil: 'முட்டைகோஸ்', category_id: 1, unit: 'kg', icon: '🥬' },
    { id: 7, name: 'Bananas', name_sinhala: 'කෙසෙල්', name_tamil: 'வாழைப்பழம்', category_id: 2, unit: 'dozen', icon: '🍌' },
    { id: 8, name: 'Papaya', name_sinhala: 'පැපොල්', name_tamil: 'பப்பாளி', category_id: 2, unit: 'kg', icon: '🥭' },
    { id: 9, name: 'Pineapple', name_sinhala: 'අන්නාසි', name_tamil: 'அன்னாசி', category_id: 2, unit: 'piece', icon: '🍍' },
    { id: 10, name: 'Mangoes', name_sinhala: 'අඹ', name_tamil: 'மாம்பழம்', category_id: 2, unit: 'kg', icon: '🥭' },
    { id: 11, name: 'Rice (White)', name_sinhala: 'සහල් (සුදු)', name_tamil: 'அரிசி (வெள்ளை)', category_id: 3, unit: 'kg', icon: '🍚' },
    { id: 12, name: 'Dhal', name_sinhala: 'පරිප්පු', name_tamil: 'பருப்பு', category_id: 3, unit: 'kg', icon: '🫘' },
    { id: 13, name: 'Cinnamon', name_sinhala: 'කුරුඳු', name_tamil: 'பட்டை', category_id: 4, unit: '100g', icon: '🌿' },
    { id: 14, name: 'Black Pepper', name_sinhala: 'ගම්මිරිස්', name_tamil: 'மிளகு', category_id: 4, unit: '100g', icon: '🌶️' },
    { id: 15, name: 'Turmeric', name_sinhala: 'කහ', name_tamil: 'மஞ்சள்', category_id: 4, unit: '100g', icon: '🧡' },
    { id: 16, name: 'Tuna Fish', name_sinhala: 'කැලවල්ලා', name_tamil: 'டுனா மீன்', category_id: 5, unit: 'kg', icon: '🐟' },
    { id: 17, name: 'Prawns', name_sinhala: 'ඉස්සන්', name_tamil: 'இறால்', category_id: 5, unit: 'kg', icon: '🦐' },
    { id: 18, name: 'Chicken', name_sinhala: 'කුකුළු මස්', name_tamil: 'கோழி', category_id: 6, unit: 'kg', icon: '🍗' },
    { id: 19, name: 'Beef', name_sinhala: 'හරක් මස්', name_tamil: 'மாட்டிறைச்சி', category_id: 6, unit: 'kg', icon: '🥩' },
    { id: 20, name: 'Fresh Milk', name_sinhala: 'නැවුම් කිරි', name_tamil: 'புதிய பால்', category_id: 7, unit: 'liter', icon: '🥛' },
    { id: 21, name: 'Eggs', name_sinhala: 'බිත්තර', name_tamil: 'முட்டைகள்', category_id: 7, unit: 'dozen', icon: '🥚' },
    { id: 22, name: 'Coconut', name_sinhala: 'පොල්', name_tamil: 'தேங்காய்', category_id: 2, unit: 'piece', icon: '🥥' }
  ],

  // Generate prices for all produce x market combinations
  generatePrices() {
    const prices = [];
    let priceId = 1;

    this.produce.forEach(item => {
      this.markets.forEach(market => {
        // Generate base price with some variation
        const basePrice = this.getBasePrice(item.id);
        const marketVariation = this.getMarketVariation(market.id);
        const price = basePrice * marketVariation;

        // Generate price change (random)
        const priceChange = (Math.random() * 10 - 5).toFixed(1); // -5% to +5%

        prices.push({
          id: priceId++,
          produce_id: item.id,
          market_id: market.id,
          price: parseFloat(price.toFixed(2)),
          currency: 'LKR',
          change: parseFloat(priceChange),
          timestamp: new Date().toISOString(),
          produce: item,
          market: market,
          category: this.categories.find(c => c.id === item.category_id)
        });
      });
    });

    return prices;
  },

  getBasePrice(produceId) {
    // Base prices for different produce items (in LKR)
    const basePrices = {
      1: 250,    // Tomatoes
      2: 180,    // Potatoes
      3: 200,    // Onions
      4: 150,    // Carrots
      5: 220,    // Green Beans
      6: 120,    // Cabbage
      7: 180,    // Bananas
      8: 140,    // Papaya
      9: 200,    // Pineapple
      10: 350,   // Mangoes
      11: 180,   // Rice
      12: 280,   // Dhal
      13: 4500,  // Cinnamon
      14: 3200,  // Black Pepper
      15: 1800,  // Turmeric
      16: 1500,  // Tuna
      17: 2800,  // Prawns
      18: 850,   // Chicken
      19: 1200,  // Beef
      20: 200,   // Fresh Milk
      21: 50,    // Eggs (per piece, so dozen = 600)
      22: 80     // Coconut
    };

    return basePrices[produceId] || 100;
  },

  getMarketVariation(marketId) {
    // Different markets have different price levels
    const variations = {
      1: 1.1,   // Manning Market (slightly higher - urban)
      2: 0.95,  // Pettah Market (competitive)
      3: 0.85,  // Dambulla (wholesale, cheapest)
      4: 1.0,   // Kandy (average)
      5: 1.05   // Galle (coastal, slightly higher)
    };

    return variations[marketId] || 1.0;
  },

  // Get best deals (lowest prices)
  getBestDeals(prices) {
    const deals = {};

    prices.forEach(price => {
      const key = price.produce_id;
      if (!deals[key] || price.price < deals[key].price) {
        deals[key] = price;
      }
    });

    return Object.values(deals).slice(0, 8); // Return top 8 deals
  },

  // Get trending items (random selection)
  getTrendingItems(prices) {
    const shuffled = [...prices].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 6);
  },

  // Get price history (30 days)
  generatePriceHistory(produceId, marketId, days = 30) {
    const history = [];
    const basePrice = this.getBasePrice(produceId);
    const marketVar = this.getMarketVariation(marketId);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Add some randomness and trend
      const seasonalEffect = Math.sin(i / 10) * 20;
      const randomVariation = (Math.random() * 30 - 15);
      const price = basePrice * marketVar + seasonalEffect + randomVariation;

      history.push({
        date: date.toISOString().split('T')[0],
        price: parseFloat(Math.max(price, basePrice * 0.5).toFixed(2))
      });
    }

    return history;
  },

  // Get price predictions (7 days)
  generatePricePredictions(produceId, marketId, days = 7) {
    const history = this.generatePriceHistory(produceId, marketId, 30);
    const avgPrice = history.reduce((sum, h) => sum + h.price, 0) / history.length;
    const predictions = [];

    for (let i = 1; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      // Simple trend prediction
      const trend = (Math.random() * 10 - 5); // -5 to +5
      const prediction = avgPrice + trend;

      predictions.push({
        date: date.toISOString().split('T')[0],
        predicted_price: parseFloat(prediction.toFixed(2)),
        lower_bound: parseFloat((prediction * 0.9).toFixed(2)),
        upper_bound: parseFloat((prediction * 1.1).toFixed(2)),
        confidence: (Math.random() * 20 + 75).toFixed(1) // 75-95% confidence
      });
    }

    return predictions;
  }
};

// Initialize prices
const allPrices = DEMO_DATA.generatePrices();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEMO_DATA, allPrices };
}
