// MealDB API Integration for Comprehensive Product Database
// This module fetches and integrates all ingredients from MealDB API

class MealDBIntegration {
    constructor() {
        this.baseURL = 'https://www.themealdb.com/api/json/v1/1';
        this.ingredientImagesBase = 'https://www.themealdb.com/images/ingredients';
        this.ingredients = [];
        this.categories = [];
        this.areas = [];
    }

    // Initialize the integration
    async initialize() {
        try {
            console.log('Initializing MealDB Integration...');
            await this.fetchAllIngredients();
            await this.fetchCategories();
            await this.fetchAreas();
            console.log(`Loaded ${this.ingredients.length} ingredients from MealDB`);
            return this.transformToMarketData();
        } catch (error) {
            console.error('Error initializing MealDB Integration:', error);
            return this.getFallbackData();
        }
    }

    // Fetch all ingredients from MealDB
    async fetchAllIngredients() {
        try {
            const response = await fetch(`${this.baseURL}/list.php?i=list`);
            const data = await response.json();
            
            if (data.meals) {
                this.ingredients = data.meals.map(ingredient => ({
                    id: ingredient.strIngredient.toLowerCase().replace(/\s+/g, '-'),
                    name: ingredient.strIngredient,
                    description: ingredient.strDescription || '',
                    type: 'ingredient'
                }));
            }
        } catch (error) {
            console.error('Error fetching ingredients:', error);
            this.ingredients = this.getFallbackIngredients();
        }
    }

    // Fetch all categories from MealDB
    async fetchCategories() {
        try {
            const response = await fetch(`${this.baseURL}/list.php?c=list`);
            const data = await response.json();
            
            if (data.meals) {
                this.categories = data.meals.map(cat => cat.strCategory);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
            this.categories = ['Vegetarian', 'Vegan', 'Meat', 'Seafood', 'Dessert'];
        }
    }

    // Fetch all areas (cuisines) from MealDB
    async fetchAreas() {
        try {
            const response = await fetch(`${this.baseURL}/list.php?a=list`);
            const data = await response.json();
            
            if (data.meals) {
                this.areas = data.meals.map(area => area.strArea);
            }
        } catch (error) {
            console.error('Error fetching areas:', error);
            this.areas = ['Sri Lankan', 'Indian', 'Chinese', 'Italian', 'American'];
        }
    }

    // Transform MealDB ingredients to market data format
    transformToMarketData() {
        const marketData = {
            vegetables: [],
            fruits: [],
            spices: [],
            meat: [],
            grains: [],
            dairy: [],
            seafood: [],
            beverages: [],
            condiments: [],
            nuts: [],
            oils: []
        };

        this.ingredients.forEach(ingredient => {
            const category = this.categorizeIngredient(ingredient.name);
            if (marketData[category]) {
                const marketItem = this.createMarketItem(ingredient, category);
                marketData[category].push(marketItem);
            }
        });

        return marketData;
    }

    // Categorize ingredients based on Sri Lankan market context
    categorizeIngredient(ingredientName) {
        const name = ingredientName.toLowerCase();
        
        // Vegetables
        if (this.isVegetable(name)) return 'vegetables';
        
        // Fruits
        if (this.isFruit(name)) return 'fruits';
        
        // Spices and herbs
        if (this.isSpice(name)) return 'spices';
        
        // Meat and poultry
        if (this.isMeat(name)) return 'meat';
        
        // Grains and cereals
        if (this.isGrain(name)) return 'grains';
        
        // Dairy products
        if (this.isDairy(name)) return 'dairy';
        
        // Seafood
        if (this.isSeafood(name)) return 'seafood';
        
        // Beverages
        if (this.isBeverage(name)) return 'beverages';
        
        // Condiments and sauces
        if (this.isCondiment(name)) return 'condiments';
        
        // Nuts and seeds
        if (this.isNut(name)) return 'nuts';
        
        // Oils and fats
        if (this.isOil(name)) return 'oils';
        
        // Default to vegetables for uncategorized items
        return 'vegetables';
    }

    // Check if ingredient is a vegetable
    isVegetable(name) {
        const vegetables = [
            'tomato', 'potato', 'onion', 'garlic', 'ginger', 'carrot', 'cabbage',
            'cauliflower', 'broccoli', 'spinach', 'lettuce', 'cucumber', 'pepper',
            'chili', 'eggplant', 'okra', 'pumpkin', 'radish', 'beetroot', 'celery',
            'leek', 'mushroom', 'corn', 'peas', 'beans', 'lentil', 'chickpea'
        ];
        return vegetables.some(veg => name.includes(veg));
    }

    // Check if ingredient is a fruit
    isFruit(name) {
        const fruits = [
            'apple', 'banana', 'orange', 'lemon', 'lime', 'mango', 'papaya',
            'pineapple', 'grape', 'strawberry', 'berry', 'cherry', 'peach',
            'plum', 'avocado', 'coconut', 'date', 'fig', 'raisin'
        ];
        return fruits.some(fruit => name.includes(fruit));
    }

    // Check if ingredient is a spice
    isSpice(name) {
        const spices = [
            'salt', 'pepper', 'cumin', 'coriander', 'turmeric', 'paprika',
            'cinnamon', 'clove', 'cardamom', 'nutmeg', 'mustard', 'fennel',
            'fenugreek', 'saffron', 'vanilla', 'oregano', 'basil', 'thyme',
            'rosemary', 'sage', 'parsley', 'cilantro', 'mint', 'dill'
        ];
        return spices.some(spice => name.includes(spice));
    }

    // Check if ingredient is meat
    isMeat(name) {
        const meats = [
            'chicken', 'beef', 'pork', 'lamb', 'mutton', 'goat', 'turkey',
            'duck', 'bacon', 'ham', 'sausage', 'meatball', 'liver', 'kidney'
        ];
        return meats.some(meat => name.includes(meat));
    }

    // Check if ingredient is a grain
    isGrain(name) {
        const grains = [
            'rice', 'wheat', 'flour', 'bread', 'pasta', 'noodle', 'oat',
            'barley', 'quinoa', 'corn', 'maize', 'millet', 'buckwheat'
        ];
        return grains.some(grain => name.includes(grain));
    }

    // Check if ingredient is dairy
    isDairy(name) {
        const dairy = [
            'milk', 'cream', 'cheese', 'butter', 'yogurt', 'curd', 'ghee',
            'paneer', 'mozzarella', 'parmesan', 'cheddar', 'feta'
        ];
        return dairy.some(dairyItem => name.includes(dairyItem));
    }

    // Check if ingredient is seafood
    isSeafood(name) {
        const seafood = [
            'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'crab', 'lobster',
            'squid', 'octopus', 'mussel', 'clam', 'oyster', 'sardine',
            'anchovy', 'cod', 'haddock', 'mackerel'
        ];
        return seafood.some(seafoodItem => name.includes(seafoodItem));
    }

    // Check if ingredient is a beverage
    isBeverage(name) {
        const beverages = [
            'water', 'juice', 'wine', 'beer', 'tea', 'coffee', 'milk',
            'soda', 'cola', 'lemonade', 'smoothie', 'shake'
        ];
        return beverages.some(beverage => name.includes(beverage));
    }

    // Check if ingredient is a condiment
    isCondiment(name) {
        const condiments = [
            'sauce', 'ketchup', 'mayonnaise', 'vinegar', 'soy', 'worcestershire',
            'tabasco', 'sriracha', 'relish', 'chutney', 'jam', 'jelly',
            'honey', 'syrup', 'molasses', 'mustard', 'relish'
        ];
        return condiments.some(condiment => name.includes(condiment));
    }

    // Check if ingredient is a nut
    isNut(name) {
        const nuts = [
            'almond', 'cashew', 'walnut', 'peanut', 'pecan', 'hazelnut',
            'pistachio', 'coconut', 'sesame', 'sunflower', 'pumpkin'
        ];
        return nuts.some(nut => name.includes(nut));
    }

    // Check if ingredient is an oil
    isOil(name) {
        const oils = [
            'oil', 'olive', 'coconut', 'vegetable', 'canola', 'sunflower',
            'sesame', 'peanut', 'corn', 'palm'
        ];
        return oils.some(oil => name.includes(oil));
    }

    // Create market item from ingredient
    createMarketItem(ingredient, category) {
        const basePrice = this.generateBasePrice(category);
        const priceVariation = (Math.random() - 0.5) * 0.2; // ±10% variation
        const currentPrice = Math.round(basePrice * (1 + priceVariation));
        
        return {
            id: ingredient.id,
            name: ingredient.name,
            sinhala: this.getSinhalaTranslation(ingredient.name),
            tamil: this.getTamilTranslation(ingredient.name),
            basePrice: basePrice,
            currentPrice: currentPrice,
            change: (priceVariation * 100),
            unit: this.getUnit(category),
            markets: this.getAvailableMarkets(category),
            image: this.getIngredientImage(ingredient.name),
            lastUpdated: new Date().toISOString().split('T')[0],
            source: 'MealDB',
            adjustability: true,
            minPrice: Math.round(basePrice * 0.7),
            maxPrice: Math.round(basePrice * 1.3),
            category: category,
            description: ingredient.description
        };
    }

    // Generate base price based on category
    generateBasePrice(category) {
        const priceRanges = {
            vegetables: { min: 50, max: 300 },
            fruits: { min: 80, max: 400 },
            spices: { min: 200, max: 1500 },
            meat: { min: 500, max: 2000 },
            grains: { min: 100, max: 500 },
            dairy: { min: 150, max: 800 },
            seafood: { min: 300, max: 1500 },
            beverages: { min: 50, max: 300 },
            condiments: { min: 100, max: 600 },
            nuts: { min: 300, max: 1200 },
            oils: { min: 200, max: 800 }
        };
        
        const range = priceRanges[category] || priceRanges.vegetables;
        return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }

    // Get Sinhala translation
    getSinhalaTranslation(englishName) {
        const translations = {
            'Chicken': 'කුකුල් මස්',
            'Beef': 'ගොනු මස්',
            'Pork': 'ඌරු මස්',
            'Fish': 'මාලු',
            'Rice': 'සහල්',
            'Tomato': 'තක්කාලි',
            'Onion': 'ලූණු',
            'Garlic': 'සුදු ලූණු',
            'Ginger': 'ඉංගු',
            'Potato': 'අල',
            'Carrot': 'කැරට්',
            'Cabbage': 'ගෝවා',
            'Chili': 'මිරිස්',
            'Banana': 'කෙසෙල්',
            'Lemon': 'දෙහි',
            'Salt': 'ලුණු',
            'Pepper': 'ගම්මිරිස්',
            'Oil': 'තෙල්'
        };
        
        for (const [key, value] of Object.entries(translations)) {
            if (englishName.toLowerCase().includes(key.toLowerCase())) {
                return value;
            }
        }
        
        return englishName; // Return original if no translation found
    }

    // Get Tamil translation
    getTamilTranslation(englishName) {
        const translations = {
            'Chicken': 'சிக்கன்',
            'Beef': 'மாட்டிறைச்சி',
            'Pork': 'பன்றி இறைச்சி',
            'Fish': 'மீன்',
            'Rice': 'அரிசி',
            'Tomato': 'தக்காளி',
            'Onion': 'வெங்காயம்',
            'Garlic': 'பூண்டு',
            'Ginger': 'இஞ்சி',
            'Potato': 'உருளைக்கிழங்கு',
            'Carrot': 'கேரட்',
            'Cabbage': 'முட்டைகோஸ்',
            'Chili': 'மிளகாய்',
            'Banana': 'வாழைப்பழம்',
            'Lemon': 'எலுமிச்சை',
            'Salt': 'உப்பு',
            'Pepper': 'மிளகு',
            'Oil': 'எண்ணெய்'
        };
        
        for (const [key, value] of Object.entries(translations)) {
            if (englishName.toLowerCase().includes(key.toLowerCase())) {
                return value;
            }
        }
        
        return englishName; // Return original if no translation found
    }

    // Get appropriate unit for category
    getUnit(category) {
        const units = {
            vegetables: 'kg',
            fruits: 'kg',
            spices: 'kg',
            meat: 'kg',
            grains: 'kg',
            dairy: 'liter',
            seafood: 'kg',
            beverages: 'liter',
            condiments: 'bottle',
            nuts: 'kg',
            oils: 'liter'
        };
        
        return units[category] || 'kg';
    }

    // Get available markets for category
    getAvailableMarkets(category) {
        const marketMapping = {
            vegetables: ['Colombo', 'Kandy', 'Galle', 'Nuwara Eliya', 'Dambulla'],
            fruits: ['Colombo', 'Galle', 'Matara', 'Kurunegala'],
            spices: ['Colombo', 'Dambulla', 'Kurunegala', 'Embilipitiya'],
            meat: ['Colombo', 'Kandy', 'Galle', 'Nuwara Eliya'],
            grains: ['Colombo', 'Dambulla', 'Kurunegala', 'Anuradhapura'],
            dairy: ['Colombo', 'Kandy', 'Nuwara Eliya'],
            seafood: ['Colombo', 'Galle', 'Matara'],
            beverages: ['Colombo', 'Kandy', 'Galle'],
            condiments: ['Colombo', 'Kandy', 'Dambulla'],
            nuts: ['Colombo', 'Kurunegala', 'Dambulla'],
            oils: ['Colombo', 'Kandy', 'Galle']
        };
        
        return marketMapping[category] || ['Colombo', 'Kandy', 'Galle'];
    }

    // Get ingredient image from MealDB
    getIngredientImage(ingredientName) {
        const formattedName = ingredientName.replace(/\s+/g, '_');
        return `${this.ingredientImagesBase}/${formattedName}.png`;
    }

    // Get fallback data if API fails
    getFallbackData() {
        return {
            vegetables: [
                { id: 'tomatoes', name: 'Tomatoes', sinhala: 'තක්කාලි', tamil: 'தக்காளி', basePrice: 120, currentPrice: 125, change: 4.2, unit: 'kg', markets: ['Colombo', 'Kandy', 'Galle'], image: 'resources/tomatoes.jpg', lastUpdated: '2024-11-19', source: 'Fallback', adjustability: true, minPrice: 100, maxPrice: 180, category: 'vegetables' }
            ],
            fruits: [
                { id: 'banana', name: 'Banana (Ambul)', sinhala: 'අම්බුල කෙසෙල්', tamil: 'வாழைப்பழம்', basePrice: 100, currentPrice: 105, change: 5.0, unit: 'kg', markets: ['Colombo', 'Galle', 'Kandy'], image: 'resources/tropical-fruits.jpg', lastUpdated: '2024-11-19', source: 'Fallback', adjustability: true, minPrice: 80, maxPrice: 140, category: 'fruits' }
            ],
            // ... other categories with fallback data
        };
    }

    // Get fallback ingredients if API fails
    getFallbackIngredients() {
        return [
            { id: 'tomato', name: 'Tomato', description: 'Fresh red tomatoes' },
            { id: 'onion', name: 'Onion', description: 'Fresh onions' },
            { id: 'garlic', name: 'Garlic', description: 'Fresh garlic cloves' },
            { id: 'ginger', name: 'Ginger', description: 'Fresh ginger root' },
            { id: 'chili', name: 'Chili Pepper', description: 'Fresh green chilies' }
        ];
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MealDBIntegration;
}