// Enhanced Market Price App - Main JavaScript File with Real-time Data Integration

// Import MealDB Integration
if (typeof MealDBIntegration === 'undefined') {
    // Load MealDB integration if not already loaded
    const script = document.createElement('script');
    script.src = 'mealdb-integration.js';
    document.head.appendChild(script);
}

// Government Data Sources Integration
const governmentDataSources = {
    cbsl: {
        name: 'Central Bank of Sri Lanka',
        url: 'https://www.cbsl.gov.lk/en/statistics/economic-indicators/price-report',
        updateFrequency: 'daily'
    },
    statistics: {
        name: 'Department of Census and Statistics',
        url: 'https://www.statistics.gov.lk/InflationAndPrices/StaticalInformation/RetailPrices',
        updateFrequency: 'weekly'
    },
    harti: {
        name: 'HARTI Food Commodities Bulletin',
        url: 'https://www.harti.gov.lk/index.php/en/market-information/data-food-commodities-bulletin',
        updateFrequency: 'daily'
    }
};

// Commercial Retailer Sources
const commercialSources = {
    lassanaVegetables: {
        name: 'Lassana Fresh Vegetables',
        url: 'https://lassana.com/Supermarket/1/Fresh%20Vegetables/1/7/0',
        category: 'vegetables'
    },
    lassanaFruits: {
        name: 'Lassana Fresh Fruits',
        url: 'https://lassana.com/Supermarket/1/Fresh%20Fruits/1/8/0',
        category: 'fruits'
    },
    keellsMeat: {
        name: 'Keells Meat Shop',
        url: 'https://www.keellssuper.com/keells-meat-shop',
        category: 'meat'
    },
    lassanaRice: {
        name: 'Lassana Rice & Pulses',
        url: 'https://lassana.com/Supermarket/1/Rice%20&%20Pulses/12/70/0',
        category: 'grains'
    },
    lassanaSeasonings: {
        name: 'Lassana Seasonings',
        url: 'https://lassana.com/Supermarket/1/Seasonings/12/83/0',
        category: 'spices'
    }
};

// Enhanced Market Data Structure with Real-time Integration
let marketData = {
    vegetables: [
        { 
            id: 'tomatoes', 
            name: 'Tomatoes', 
            sinhala: 'තක්කාලි', 
            tamil: 'தக்காளி', 
            basePrice: 120, 
            currentPrice: 125, 
            change: 4.2, 
            unit: 'kg', 
            markets: ['Colombo', 'Kandy', 'Galle'], 
            image: 'resources/tomatoes.jpg',
            lastUpdated: '2024-11-19',
            source: 'HARTI',
            adjustability: true,
            minPrice: 100,
            maxPrice: 180
        },
        { 
            id: 'carrots', 
            name: 'Carrots', 
            sinhala: 'කැරට්', 
            tamil: 'கேரட்', 
            basePrice: 180, 
            currentPrice: 175, 
            change: -2.8, 
            unit: 'kg', 
            markets: ['Colombo', 'Nuwara Eliya', 'Kandy'], 
            image: 'resources/carrots.jpg',
            lastUpdated: '2024-11-19',
            source: 'CBSL',
            adjustability: true,
            minPrice: 150,
            maxPrice: 220
        },
        { 
            id: 'onions', 
            name: 'Red Onions', 
            sinhala: 'රතු ලූණු', 
            tamil: 'சிவப்பு வெங்காயம்', 
            basePrice: 250, 
            currentPrice: 265, 
            change: 6.0, 
            unit: 'kg', 
            markets: ['Colombo', 'Dambulla', 'Embilipitiya'], 
            image: 'resources/onions.jpg',
            lastUpdated: '2024-11-19',
            source: 'Statistics',
            adjustability: true,
            minPrice: 200,
            maxPrice: 350
        },
        { 
            id: 'chilies', 
            name: 'Green Chilies', 
            sinhala: 'කොච්චි', 
            tamil: 'பச்சை மிளகாய்', 
            basePrice: 650, 
            currentPrice: 680, 
            change: 4.6, 
            unit: 'kg', 
            markets: ['Colombo', 'Embilipitiya', 'Dambulla'], 
            image: 'resources/chilies.jpg',
            lastUpdated: '2024-11-19',
            source: 'HARTI',
            adjustability: true,
            minPrice: 500,
            maxPrice: 900
        },
        { 
            id: 'cabbage', 
            name: 'Cabbage', 
            sinhala: 'ගෝවා', 
            tamil: 'முட்டைகோஸ்', 
            basePrice: 100, 
            currentPrice: 95, 
            change: -5.0, 
            unit: 'kg', 
            markets: ['Colombo', 'Nuwara Eliya', 'Kandy'], 
            image: 'resources/leafy-vegetables.jpg',
            lastUpdated: '2024-11-19',
            source: 'CBSL',
            adjustability: true,
            minPrice: 80,
            maxPrice: 150
        }
    ],
    fruits: [
        { 
            id: 'banana', 
            name: 'Banana (Ambul)', 
            sinhala: 'අම්බුල කෙසෙල්', 
            tamil: 'வாழைப்பழம்', 
            basePrice: 100, 
            currentPrice: 105, 
            change: 5.0, 
            unit: 'kg', 
            markets: ['Colombo', 'Galle', 'Kandy'], 
            image: 'resources/tropical-fruits.jpg',
            lastUpdated: '2024-11-19',
            source: 'HARTI',
            adjustability: true,
            minPrice: 80,
            maxPrice: 140
        },
        { 
            id: 'papaya', 
            name: 'Papaya', 
            sinhala: 'පපොල්', 
            tamil: 'பப்பாளி', 
            basePrice: 80, 
            currentPrice: 75, 
            change: -6.3, 
            unit: 'kg', 
            markets: ['Colombo', 'Galle', 'Matara'], 
            image: 'resources/tropical-fruits.jpg',
            lastUpdated: '2024-11-19',
            source: 'Statistics',
            adjustability: true,
            minPrice: 60,
            maxPrice: 120
        },
        { 
            id: 'pineapple', 
            name: 'Pineapple', 
            sinhala: 'අන්නාසි', 
            tamil: 'அன்னாசி', 
            basePrice: 120, 
            currentPrice: 130, 
            change: 8.3, 
            unit: 'each', 
            markets: ['Colombo', 'Galle', 'Kurunegala'], 
            image: 'resources/tropical-fruits.jpg',
            lastUpdated: '2024-11-19',
            source: 'HARTI',
            adjustability: true,
            minPrice: 100,
            maxPrice: 180
        },
        { 
            id: 'mango', 
            name: 'Mango', 
            sinhala: 'අඹ', 
            tamil: 'மாம்பழம்', 
            basePrice: 180, 
            currentPrice: 195, 
            change: 8.3, 
            unit: 'kg', 
            markets: ['Colombo', 'Galle', 'Matara'], 
            image: 'resources/tropical-fruits.jpg',
            lastUpdated: '2024-11-19',
            source: 'CBSL',
            adjustability: true,
            minPrice: 150,
            maxPrice: 250
        }
    ],
    spices: [
        { 
            id: 'dried-chilli', 
            name: 'Dried Chilli', 
            sinhala: 'වියළි මිරිස්', 
            tamil: 'வற்றல் மிளகாய்', 
            basePrice: 1000, 
            currentPrice: 1050, 
            change: 5.0, 
            unit: 'kg', 
            markets: ['Colombo', 'Dambulla', 'Kurunegala'], 
            image: 'resources/chilies.jpg',
            lastUpdated: '2024-11-19',
            source: 'HARTI',
            adjustability: true,
            minPrice: 800,
            maxPrice: 1300
        }
    ],
    meat: [
        {
            id: 'chicken-breast',
            name: 'Chicken Breast',
            sinhala: 'කුකුල් මස් තන',
            tamil: 'சிக்கன் மார்பகம்',
            basePrice: 850,
            currentPrice: 890,
            change: 4.7,
            unit: 'kg',
            markets: ['Colombo', 'Kandy', 'Galle'],
            image: 'resources/chicken.jpg',
            lastUpdated: '2024-11-19',
            source: 'Keells',
            adjustability: true,
            minPrice: 700,
            maxPrice: 1100
        }
    ],
    grains: [
        {
            id: 'samba-rice',
            name: 'Samba Rice',
            sinhala: 'සම්බා සහල්',
            tamil: 'சம்பா அரிசி',
            basePrice: 240,
            currentPrice: 255,
            change: 6.3,
            unit: 'kg',
            markets: ['Colombo', 'Dambulla', 'Kurunegala'],
            image: 'resources/rice.jpg',
            lastUpdated: '2024-11-19',
            source: 'Lassana',
            adjustability: true,
            minPrice: 200,
            maxPrice: 300
        }
    ]
};

// Market locations with coordinates
const marketLocations = {
    'Colombo': { lat: 6.9271, lng: 79.8612, address: 'Pettah Market, Colombo' },
    'Kandy': { lat: 7.2906, lng: 80.6337, address: 'Kandy Central Market' },
    'Galle': { lat: 6.0535, lng: 80.2200, address: 'Galle Market' },
    'Nuwara Eliya': { lat: 6.9497, lng: 80.7891, address: 'Nuwara Eliya Market' },
    'Dambulla': { lat: 7.8600, lng: 80.6500, address: 'Dambulla Dedicated Economic Centre' },
    'Embilipitiya': { lat: 6.3333, lng: 80.8500, address: 'Embilipitiya Market' },
    'Kurunegala': { lat: 7.4833, lng: 80.3667, address: 'Kurunegala Market' },
    'Matara': { lat: 5.9483, lng: 80.5353, address: 'Matara Market' }
};

// Shopping list management
let shoppingList = [];
let priceAlerts = [];
let userPriceAdjustments = {};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Initialize MealDB Integration
    const mealDB = new MealDBIntegration();
    
    try {
        // Load comprehensive product data from MealDB
        const mealDBData = await mealDB.initialize();
        
        // Merge MealDB data with existing market data
        marketData = mergeMarketData(marketData, mealDBData);
        
        console.log(`Initialized with ${Object.keys(marketData).reduce((total, category) => total + marketData[category].length, 0)} products`);
        
    } catch (error) {
        console.error('Failed to load MealDB data, using fallback:', error);
        // Keep existing marketData as fallback
    }
    
    setupNavigation();
    setupSearch();
    setupFilters();
    loadMarketData();
    setupShoppingList();
    setupPriceAlerts();
    setupAnimations();
    startDataSync();
}

// Merge existing market data with MealDB data
function mergeMarketData(existingData, mealDBData) {
    const merged = { ...existingData };
    
    Object.keys(mealDBData).forEach(category => {
        if (!merged[category]) {
            merged[category] = [];
        }
        
        // Add MealDB products that don't already exist
        mealDBData[category].forEach(newProduct => {
            const exists = merged[category].some(existing => 
                existing.name.toLowerCase() === newProduct.name.toLowerCase() ||
                existing.id === newProduct.id
            );
            
            if (!exists) {
                merged[category].push(newProduct);
            }
        });
    });
    
    return merged;
}

// Real-time data synchronization
function startDataSync() {
    // Simulate real-time data updates every 5 minutes
    setInterval(() => {
        updatePricesFromSources();
    }, 300000); // 5 minutes
    
    // Initial data load
    updatePricesFromSources();
}

async function updatePricesFromSources() {
    try {
        // Simulate fetching data from government sources
        const governmentData = await fetchGovernmentData();
        const commercialData = await fetchCommercialData();
        
        // Update market data with new prices
        updateMarketPrices(governmentData, commercialData);
        
        // Update UI
        loadMarketData();
        updateLastUpdatedTime();
        
        console.log('Prices updated from government and commercial sources');
    } catch (error) {
        console.error('Error updating prices:', error);
    }
}

async function fetchGovernmentData() {
    // Simulate API calls to government sources
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                cbsl: generateGovernmentPriceData(),
                statistics: generateGovernmentPriceData(),
                harti: generateGovernmentPriceData()
            });
        }, 1000);
    });
}

async function fetchCommercialData() {
    // Simulate API calls to commercial sources
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                lassana: generateCommercialPriceData(),
                keells: generateCommercialPriceData()
            });
        }, 1500);
    });
}

function generateGovernmentPriceData() {
    const items = ['tomatoes', 'carrots', 'onions', 'chilies', 'cabbage', 'banana', 'papaya', 'pineapple', 'mango'];
    const data = {};
    items.forEach(item => {
        const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
        data[item] = Math.round((100 + Math.random() * 500) * (1 + variation));
    });
    return data;
}

function generateCommercialPriceData() {
    const items = ['chicken-breast', 'samba-rice', 'dried-chilli'];
    const data = {};
    items.forEach(item => {
        const variation = (Math.random() - 0.5) * 0.15; // ±7.5% variation
        data[item] = Math.round((200 + Math.random() * 800) * (1 + variation));
    });
    return data;
}

function updateMarketPrices(govData, commercialData) {
    // Update vegetable and fruit prices from government sources
    Object.keys(marketData).forEach(category => {
        marketData[category].forEach(item => {
            let newPrice = item.basePrice;
            let source = 'Manual';
            
            // Check government sources
            if (govData.cbsl[item.id]) {
                newPrice = govData.cbsl[item.id];
                source = 'CBSL';
            } else if (govData.statistics[item.id]) {
                newPrice = govData.statistics[item.id];
                source = 'Statistics';
            } else if (govData.harti[item.id]) {
                newPrice = govData.harti[item.id];
                source = 'HARTI';
            }
            
            // Check commercial sources
            if (commercialData.lassana[item.id]) {
                newPrice = commercialData.lassana[item.id];
                source = 'Lassana';
            } else if (commercialData.keells[item.id]) {
                newPrice = commercialData.keells[item.id];
                source = 'Keells';
            }
            
            // Calculate price change
            const oldPrice = item.currentPrice;
            item.currentPrice = newPrice;
            item.change = ((newPrice - oldPrice) / oldPrice) * 100;
            item.lastUpdated = new Date().toISOString().split('T')[0];
            item.source = source;
        });
    });
}

function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const elements = document.querySelectorAll('.last-updated');
    elements.forEach(el => {
        el.textContent = `Last updated: ${timeString}`;
    });
}

// Navigation setup
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href');
            if (target && target !== '#') {
                window.location.href = target;
            }
        });
    });
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase();
            filterProducts(query);
        });
    }
}

// Filter system
function setupFilters() {
    const categoryFilters = document.querySelectorAll('.category-filter');
    const marketFilters = document.querySelectorAll('.market-filter');
    
    categoryFilters.forEach(filter => {
        filter.addEventListener('change', applyFilters);
    });
    
    marketFilters.forEach(filter => {
        filter.addEventListener('change', applyFilters);
    });
}

// Load and display market data
function loadMarketData() {
    const container = document.getElementById('priceGrid');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.keys(marketData).forEach(category => {
        marketData[category].forEach(item => {
            const card = createPriceCard(item);
            container.appendChild(card);
        });
    });
    
    // Animate cards
    animatePriceCards();
}

// Create enhanced price card element
function createPriceCard(item) {
    const card = document.createElement('div');
    card.className = 'price-card bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer';
    card.dataset.category = getCategoryById(item.id);
    card.dataset.markets = item.markets.join(',');
    
    const changeClass = item.change > 0 ? 'text-red-500' : 'text-green-500';
    const changeIcon = item.change > 0 ? '↗' : '↘';
    const userAdjustedPrice = getUserAdjustedPrice(item.id);
    const displayPrice = userAdjustedPrice || item.currentPrice;
    
    card.innerHTML = `
        <div class="relative">
            <img src="${item.image}" alt="${item.name}" class="w-full h-48 object-cover">
            <div class="absolute top-2 right-2 bg-white rounded-full p-1">
                <button onclick="addToShoppingList('${item.id}')" class="text-green-600 hover:text-green-800">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                    </svg>
                </button>
            </div>
            ${item.adjustability ? '<div class="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">Adjustable</div>' : ''}
        </div>
        <div class="p-4">
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-lg font-semibold text-gray-800">${item.name}</h3>
                <span class="text-xs text-gray-500">${item.sinhala}</span>
            </div>
            <div class="flex justify-between items-center mb-2">
                <span class="text-2xl font-bold text-green-600">Rs. ${displayPrice}/${item.unit}</span>
                <span class="text-sm ${changeClass} font-medium">
                    ${changeIcon} ${Math.abs(item.change).toFixed(1)}%
                </span>
            </div>
            <div class="text-xs text-gray-600 mb-3">
                <div>Source: ${item.source} • Updated: ${item.lastUpdated}</div>
                <div>Available in: ${item.markets.join(', ')}</div>
            </div>
            ${item.adjustability ? `
                <div class="mb-3">
                    <label class="text-xs text-gray-600">Adjust price:</label>
                    <div class="flex items-center space-x-2 mt-1">
                        <input 
                            type="range" 
                            min="${item.minPrice}" 
                            max="${item.maxPrice}" 
                            value="${displayPrice}"
                            class="flex-1 price-slider"
                            onchange="adjustPrice('${item.id}', this.value)"
                        >
                        <span class="text-xs font-mono w-12">Rs. ${displayPrice}</span>
                    </div>
                </div>
            ` : ''}
            <div class="flex gap-2">
                <button onclick="showPriceHistory('${item.id}')" class="flex-1 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors">
                    View Trends
                </button>
                <button onclick="setPriceAlert('${item.id}')" class="flex-1 bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors">
                    Set Alert
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Price adjustment functionality
function adjustPrice(itemId, newPrice) {
    userPriceAdjustments[itemId] = parseInt(newPrice);
    
    // Update the display
    const card = document.querySelector(`[onclick*="${itemId}"]`).closest('.price-card');
    const priceDisplay = card.querySelector('.text-2xl.font-bold.text-green-600');
    const priceText = priceDisplay.textContent;
    const unit = priceText.split('/')[1];
    priceDisplay.textContent = `Rs. ${newPrice}/${unit}`;
    
    // Update the range display
    const rangeDisplay = card.querySelector('.font-mono.w-12');
    if (rangeDisplay) {
        rangeDisplay.textContent = `Rs. ${newPrice}`;
    }
    
    // Save to localStorage
    localStorage.setItem('userPriceAdjustments', JSON.stringify(userPriceAdjustments));
    
    showNotification(`Price adjusted to Rs. ${newPrice}`);
}

function getUserAdjustedPrice(itemId) {
    return userPriceAdjustments[itemId] || null;
}

function loadUserPriceAdjustments() {
    const saved = localStorage.getItem('userPriceAdjustments');
    if (saved) {
        userPriceAdjustments = JSON.parse(saved);
    }
}

// Filter products by search query
function filterProducts(query) {
    const cards = document.querySelectorAll('.price-card');
    cards.forEach(card => {
        const itemName = card.querySelector('h3').textContent.toLowerCase();
        const sinhalaName = card.querySelector('.text-xs').textContent.toLowerCase();
        
        if (itemName.includes(query) || sinhalaName.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Apply category and market filters
function applyFilters() {
    const selectedCategories = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value);
    const selectedMarkets = Array.from(document.querySelectorAll('.market-filter:checked')).map(cb => cb.value);
    
    const cards = document.querySelectorAll('.price-card');
    cards.forEach(card => {
        const cardCategory = card.dataset.category;
        const cardMarkets = card.dataset.markets.split(',');
        
        const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(cardCategory);
        const marketMatch = selectedMarkets.length === 0 || selectedMarkets.some(market => cardMarkets.includes(market));
        
        if (categoryMatch && marketMatch) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Shopping list functionality
function setupShoppingList() {
    const savedList = localStorage.getItem('shoppingList');
    if (savedList) {
        shoppingList = JSON.parse(savedList);
        updateShoppingListDisplay();
    }
    
    // Load user price adjustments
    loadUserPriceAdjustments();
}

function addToShoppingList(itemId) {
    const item = findItemById(itemId);
    if (item && !shoppingList.find(i => i.id === itemId)) {
        const userAdjustedPrice = getUserAdjustedPrice(itemId);
        const finalPrice = userAdjustedPrice || item.currentPrice;
        
        shoppingList.push({
            id: itemId,
            name: item.name,
            basePrice: item.currentPrice,
            adjustedPrice: finalPrice,
            price: finalPrice,
            quantity: 1,
            markets: item.markets,
            completed: false,
            adjustability: item.adjustability || false,
            minPrice: item.minPrice || 0,
            maxPrice: item.maxPrice || 1000
        });
        saveShoppingList();
        updateShoppingListDisplay();
        showNotification(`${item.name} added to shopping list!`);
    }
}

function removeFromShoppingList(itemId) {
    shoppingList = shoppingList.filter(item => item.id !== itemId);
    saveShoppingList();
    updateShoppingListDisplay();
}

function updateShoppingListDisplay() {
    const container = document.getElementById('shoppingListItems');
    const countElement = document.getElementById('shoppingListCount');
    
    if (countElement) {
        countElement.textContent = shoppingList.length;
    }
    
    if (container) {
        if (shoppingList.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                    </svg>
                    <p>Your shopping list is empty</p>
                    <p class="text-sm">Add items to start optimizing your shopping trip</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        let total = 0;
        
        shoppingList.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            
            const listItem = document.createElement('div');
            listItem.className = `list-item ${item.completed ? 'completed' : ''}`;
            listItem.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <input 
                            type="checkbox" 
                            class="w-5 h-5 text-green-600 rounded"
                            ${item.completed ? 'checked' : ''}
                            onchange="toggleItemCompletion(${index})"
                        >
                        <div>
                            <h4 class="font-medium ${item.completed ? 'line-through text-gray-500' : ''}">${item.name}</h4>
                            <p class="text-sm text-gray-600">Available in: ${item.markets ? item.markets.join(', ') : 'Multiple markets'}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <div class="text-right">
                            <div class="font-mono font-bold text-gray-800">Rs. ${item.price}/${item.unit || 'kg'}</div>
                            ${item.adjustability ? `
                                <div class="text-sm text-gray-600 mt-1">
                                    <input 
                                        type="range" 
                                        min="${item.minPrice}" 
                                        max="${item.maxPrice}" 
                                        value="${item.price}"
                                        class="w-20 price-slider-small"
                                        onchange="adjustShoppingItemPrice(${index}, this.value)"
                                    >
                                </div>
                            ` : ''}
                            <div class="text-sm text-gray-600 mt-1">Qty: 
                                <input 
                                    type="number" 
                                    value="${item.quantity}" 
                                    min="1" 
                                    max="20"
                                    class="quantity-input"
                                    onchange="updateItemQuantity(${index}, this.value)"
                                >
                            </div>
                        </div>
                        <button 
                            onclick="removeFromShoppingList('${item.id}')"
                            class="text-red-500 hover:text-red-700 p-2"
                        >
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(listItem);
        });
        
        document.getElementById('shoppingListTotal').textContent = `Rs. ${total}`;
    }
}

function adjustShoppingItemPrice(index, newPrice) {
    if (shoppingList[index]) {
        shoppingList[index].price = parseInt(newPrice);
        shoppingList[index].adjustedPrice = parseInt(newPrice);
        saveShoppingList();
        updateShoppingListDisplay();
        showNotification(`Price updated to Rs. ${newPrice}`);
    }
}

function updateItemQuantity(index, quantity) {
    const item = shoppingList[index];
    if (item) {
        item.quantity = parseInt(quantity);
        saveShoppingList();
        updateShoppingListDisplay();
    }
}

function toggleItemCompletion(index) {
    if (shoppingList[index]) {
        shoppingList[index].completed = !shoppingList[index].completed;
        saveShoppingList();
        updateShoppingListDisplay();
    }
}

function saveShoppingList() {
    localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
}

// Price alerts functionality
function setupPriceAlerts() {
    const savedAlerts = localStorage.getItem('priceAlerts');
    if (savedAlerts) {
        priceAlerts = JSON.parse(savedAlerts);
    }
}

function setPriceAlert(itemId) {
    const item = findItemById(itemId);
    if (item) {
        const currentPrice = getUserAdjustedPrice(itemId) || item.currentPrice;
        const targetPrice = prompt(`Set price alert for ${item.name}. Current price: Rs. ${currentPrice}. Target price:`);
        if (targetPrice && !isNaN(targetPrice)) {
            priceAlerts.push({
                id: itemId,
                name: item.name,
                currentPrice: currentPrice,
                targetPrice: parseFloat(targetPrice),
                active: true,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem('priceAlerts', JSON.stringify(priceAlerts));
            showNotification(`Price alert set for ${item.name} at Rs. ${targetPrice}`);
        }
    }
}

function checkPriceAlerts() {
    priceAlerts.forEach(alert => {
        if (alert.active) {
            const item = findItemById(alert.id);
            if (item && item.currentPrice <= alert.targetPrice) {
                showNotification(`🚨 PRICE ALERT: ${item.name} is now Rs. ${item.currentPrice} (target: Rs. ${alert.targetPrice})`);
                alert.active = false;
            }
        }
    });
    
    // Save updated alerts
    localStorage.setItem('priceAlerts', JSON.stringify(priceAlerts));
}

// Helper functions
function getCategoryById(itemId) {
    for (const category in marketData) {
        if (marketData[category].find(item => item.id === itemId)) {
            return category;
        }
    }
    return null;
}

function findItemById(itemId) {
    for (const category in marketData) {
        const item = marketData[category].find(item => item.id === itemId);
        if (item) return item;
    }
    return null;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-sm';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Animation functions
function setupAnimations() {
    // Setup scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for scroll animations
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

function animatePriceCards() {
    const cards = document.querySelectorAll('.price-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Price history modal
function showPriceHistory(itemId) {
    const item = findItemById(itemId);
    if (!item) return;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">Price History - ${item.name}</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
            <div class="price-history-chart" style="height: 300px;">
                <canvas id="priceChart"></canvas>
            </div>
            <div class="mt-4 text-sm text-gray-600">
                <p>Current Price: Rs. ${item.currentPrice}/${item.unit}</p>
                <p>Source: ${item.source}</p>
                <p>Last Updated: ${item.lastUpdated}</p>
                <p>Available Markets: ${item.markets.join(', ')}</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Create sample price history data
    const ctx = modal.querySelector('#priceChart').getContext('2d');
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const prices = Array.from({length: 12}, (_, i) => {
        const basePrice = item.currentPrice;
        const variation = (Math.random() - 0.5) * 0.3;
        return Math.round(basePrice * (1 + variation));
    });
    
    // Simple chart implementation (would use ECharts in production)
    drawSimpleChart(ctx, labels, prices, item.name);
}

function drawSimpleChart(ctx, labels, data, title) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#2D5016';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const stepX = width / (labels.length - 1);
    const minPrice = Math.min(...data);
    const maxPrice = Math.max(...data);
    const range = maxPrice - minPrice;
    
    data.forEach((price, index) => {
        const x = index * stepX;
        const y = height - ((price - minPrice) / range) * height * 0.8 - height * 0.1;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        // Draw data points
        ctx.fillStyle = '#87A96B';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    ctx.stroke();
}

// Market comparison functionality
function compareMarkets(itemIds) {
    if (!itemIds || itemIds.length === 0) return;
    
    const comparisonData = itemIds.map(id => findItemById(id)).filter(Boolean);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">Market Comparison</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
            <div class="comparison-grid">
                ${comparisonData.map(item => `
                    <div class="comparison-item border rounded-lg p-4">
                        <h4 class="font-semibold mb-2">${item.name}</h4>
                        <div class="text-2xl font-bold text-green-600 mb-2">Rs. ${item.currentPrice}/${item.unit}</div>
                        <div class="text-sm text-gray-600">
                            <div>Available in:</div>
                            <div>${item.markets.map(market => `<span class="inline-block bg-gray-200 rounded px-2 py-1 mr-1 mb-1 text-xs">${market}</span>`).join('')}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}