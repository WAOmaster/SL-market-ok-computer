# Claude Project Documentation
**Sri Lanka Market Price Tracker**

Last Updated: 2025-11-19
Branch: `claude/market-price-tracker-01HRDGZdW3WQ7rfUb1RCfw1F`

---

## 📋 Important Protocols

### **Testing Protocol** ⚠️
**CRITICAL**: All implementations MUST be tested using the **webapp-testing** skill before committing to git.

**Workflow**:
1. Implement feature/fix
2. **Use webapp-testing skill** to test thoroughly
3. Fix any issues found
4. Commit to git
5. Push to remote

**Command Format**:
```
Use the webapp-testing skill to test [feature/component]
```

---

## 📊 Project Overview

### **Application Type**
Web-based market price tracking application for Sri Lanka

### **Purpose**
Track and compare prices of vegetables, fruits, spices, meat, and grains across different markets in Sri Lanka

### **Technology Stack**

#### **Frontend** (✅ Implemented)
- HTML5, CSS3, Tailwind CSS
- Vanilla JavaScript (ES6+)
- Anime.js (animations)
- ECharts.js (data visualization)
- Leaflet.js (maps)

#### **Backend** (❌ Not Implemented)
- **Status**: No backend currently exists
- **Needed**: Node.js/Express or Python/FastAPI
- **Database**: PostgreSQL (not set up)
- **Caching**: Redis (not set up)
- **Authentication**: JWT (not implemented)

---

## 📁 Project Structure

```
SL-market-ok-computer/
├── index.html              ✅ Main dashboard page
├── compare.html            ✅ Price comparison tool
├── trends.html             ✅ Price trends analysis
├── list.html               ✅ Shopping list optimizer
├── main.js                 ✅ Core JavaScript functionality
├── mealdb-integration.js   ✅ MealDB API integration
├── resources/              ✅ Product images
│   ├── tomatoes.jpg
│   ├── carrots.jpg
│   ├── onions.jpg
│   ├── chilies.jpg
│   ├── chicken.jpg
│   ├── rice.jpg
│   └── ...
├── skills/                 ✅ 38 Claude skills (installed)
├── project_outline.md      ✅ Project specifications
├── interaction.md          ✅ Interaction design docs
├── design.md               ✅ Design style guide
├── SKILLS_GUIDE.md         ✅ Comprehensive skills documentation
├── QUICK_SKILLS_REFERENCE.md ✅ Quick skills reference
└── CLAUDE.md               📄 This file
```

---

## 🎯 Current Implementation Status

### ✅ **Completed Features**

#### **1. Frontend Pages** (100% Complete)
- **index.html**: Main dashboard with product grid
  - Hero section with search
  - Market overview stats
  - Interactive price cards
  - Filter sidebar (categories, markets, price range)
  - Product grid with 11+ products

- **compare.html**: Price comparison tool
  - Market selection interface
  - Product comparison grid
  - Savings calculator
  - Best price highlighting

- **trends.html**: Price trends analysis
  - Interactive charts (ECharts)
  - Time period selectors
  - Trend visualization

- **list.html**: Shopping list optimizer
  - Shopping list builder
  - Budget tracking
  - Market optimization
  - Route planning (Leaflet maps)

#### **2. Core JavaScript Features** (main.js)
- ✅ Product data management (11+ products)
- ✅ Search functionality (English, Sinhala, Tamil)
- ✅ Category and market filtering
- ✅ Shopping list (LocalStorage)
- ✅ Price alerts (LocalStorage)
- ✅ Price adjustment sliders
- ✅ Smooth animations
- ✅ Responsive design
- ✅ Real-time simulated updates

#### **3. Product Categories**
- **Vegetables**: Tomatoes, Carrots, Red Onions, Green Chilies, Cabbage
- **Fruits**: Banana (Ambul), Papaya, Pineapple, Mango
- **Spices**: Dried Chilli
- **Meat**: Chicken Breast
- **Grains**: Samba Rice

#### **4. Market Coverage** (Simulated)
- Colombo (Pettah Market)
- Kandy (Central Market)
- Galle (Main Market)
- Nuwara Eliya
- Dambulla (Economic Centre)
- Embilipitiya
- Kurunegala
- Matara

#### **5. Skills Installation**
- ✅ 38 skills installed to `~/.claude/skills/`
- ✅ Comprehensive documentation created
- ✅ Quick reference guide available

---

## ❌ **Not Implemented (Backend Required)**

### **1. Backend API Server**
**Status**: Not built
**Needed**:
- REST API endpoints
- Node.js/Express or Python/FastAPI
- API documentation

**Required Endpoints**:
```javascript
GET    /api/products              // Get all products
GET    /api/products/:id          // Get single product
GET    /api/prices/current        // Get current prices
GET    /api/prices/history/:id    // Get price history
POST   /api/alerts                // Create price alert
GET    /api/markets               // Get market locations
POST   /api/shopping-list         // Save shopping list
GET    /api/shopping-list/:userId // Get user's list
PUT    /api/shopping-list/:id     // Update shopping list
DELETE /api/shopping-list/:id     // Delete shopping list
```

### **2. Database**
**Status**: Not set up
**Needed**:
- PostgreSQL database
- Schema design
- Migrations

**Required Tables**:
```sql
-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_sinhala VARCHAR(255),
    name_tamil VARCHAR(255),
    category VARCHAR(100),
    unit VARCHAR(20),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Prices table
CREATE TABLE prices (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id),
    market_id INT REFERENCES markets(id),
    price DECIMAL(10,2),
    date DATE,
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Markets table
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    location VARCHAR(255),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shopping lists table
CREATE TABLE shopping_lists (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shopping list items
CREATE TABLE shopping_list_items (
    id SERIAL PRIMARY KEY,
    list_id INT REFERENCES shopping_lists(id),
    product_id INT REFERENCES products(id),
    quantity INT,
    completed BOOLEAN DEFAULT FALSE
);

-- Price alerts
CREATE TABLE price_alerts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    product_id INT REFERENCES products(id),
    target_price DECIMAL(10,2),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **3. Web Scraping**
**Status**: Not implemented
**Needed**:
- HARTI price data scraper
- Commercial retailer scrapers
- Scheduled scraping (cron jobs)
- Data validation

**Target Data Sources**:
```javascript
// Government Sources (NOT integrated)
1. HARTI Food Commodities Bulletin
   URL: https://www.harti.gov.lk/index.php/en/market-information/data-food-commodities-bulletin

2. Central Bank of Sri Lanka
   URL: https://www.cbsl.gov.lk/en/statistics/economic-indicators/price-report

3. Department of Census and Statistics
   URL: https://www.statistics.gov.lk/InflationAndPrices/StaticalInformation/RetailPrices

// Commercial Sources (NOT integrated)
4. Lassana Fresh Vegetables
   URL: https://lassana.com/Supermarket/1/Fresh%20Vegetables/1/7/0

5. Keells Meat Shop
   URL: https://www.keellssuper.com/keells-meat-shop
```

### **4. Authentication & User Management**
**Status**: Not implemented
**Needed**:
- User registration/login
- JWT token authentication
- Password hashing (bcrypt)
- Session management
- Protected routes

### **5. Real-time Features**
**Status**: Not implemented (currently simulated)
**Needed**:
- WebSocket server
- Real-time price updates
- Live price alerts
- Push notifications

### **6. Machine Learning**
**Status**: Not implemented
**Needed**:
- Price prediction models
- Seasonal pattern analysis
- Anomaly detection
- Recommendation system

### **7. DevOps & Deployment**
**Status**: Not implemented
**Needed**:
- Docker containerization
- CI/CD pipeline
- Production hosting
- Monitoring and logging
- Automated backups

---

## 🔧 Recent Fixes & Updates

### **Fix: Product Grid Not Displaying** (Commit: 4184f0b)
**Date**: 2025-11-19

**Problem**:
- Products weren't showing on index.html
- Async loading timing issue with MealDBIntegration
- Script initialization order was wrong

**Solution**:
1. Fixed `main.js` initialization order
   - Load static data first (immediate display)
   - Make MealDB integration optional and non-blocking
2. Added `mealdb-integration.js` script to all HTML files
3. Removed dynamic script loading

**Files Modified**:
- main.js (lines 1-330)
- index.html (line 494)
- compare.html (line 426)
- trends.html (line 547)
- list.html (line 450)

**Result**: Products now display immediately on page load ✅

---

## 📚 Skills Available

**Location**: `~/.claude/skills/` (38 skills installed)

### **Top Skills for This Project**

#### **High Priority** (⭐⭐⭐)
1. **webapp-testing** - Test web app functionality (**REQUIRED BEFORE COMMITS**)
2. **senior-fullstack** - Full-stack development
3. **scraping-best-practices** - Web scraping for price data
4. **ui-styling** - CSS/animations improvements
5. **ux-designer** - User experience optimization
6. **senior-data-engineer** - Data pipeline development
7. **senior-backend** - Backend API development

#### **Medium Priority** (⭐⭐)
8. **senior-data-scientist** - Price prediction ML
9. **senior-ml-engineer** - ML deployment
10. **frontend-design** - UI/UX design
11. **senior-devops** - Deployment & CI/CD
12. **senior-qa** - Testing strategy
13. **playwright-skill** - E2E testing
14. **senior-security** - Security auditing

#### **Usage**
```
Use the [skill-name] skill to [task description]
```

**Example**:
```
Use the webapp-testing skill to test the shopping list functionality
```

**Documentation**:
- See `SKILLS_GUIDE.md` for detailed skill documentation
- See `QUICK_SKILLS_REFERENCE.md` for quick reference

---

## 🚀 Next Steps / Roadmap

### **Phase 1: Backend Foundation** (Not Started)
**Priority**: HIGH

#### Option A: Build Backend API
1. ⬜ Set up Node.js/Express or FastAPI server
2. ⬜ Create PostgreSQL database schema
3. ⬜ Implement REST API endpoints
4. ⬜ **Test with webapp-testing skill**
5. ⬜ Commit and push

**Recommended Skill**: `senior-fullstack` or `senior-backend`

#### Option B: Build Web Scraper
1. ⬜ Create HARTI price data scraper
2. ⬜ Implement data validation
3. ⬜ Set up scheduled scraping
4. ⬜ **Test with webapp-testing skill**
5. ⬜ Commit and push

**Recommended Skill**: `scraping-best-practices`

### **Phase 2: Data Pipeline** (Not Started)
**Priority**: HIGH

1. ⬜ Scheduled data collection (cron jobs)
2. ⬜ Data cleaning and validation
3. ⬜ Price history storage
4. ⬜ Market data aggregation
5. ⬜ **Test with webapp-testing skill**
6. ⬜ Commit and push

**Recommended Skill**: `senior-data-engineer`

### **Phase 3: Frontend Integration** (Not Started)
**Priority**: MEDIUM

1. ⬜ Connect frontend to backend API
2. ⬜ Replace mock data with real API calls
3. ⬜ Implement error handling
4. ⬜ Add loading states
5. ⬜ **Test with webapp-testing skill**
6. ⬜ Commit and push

**Recommended Skill**: `senior-frontend`

### **Phase 4: Authentication** (Not Started)
**Priority**: MEDIUM

1. ⬜ User registration/login
2. ⬜ JWT authentication
3. ⬜ Protected routes
4. ⬜ User profile management
5. ⬜ **Test with webapp-testing skill**
6. ⬜ Commit and push

**Recommended Skill**: `senior-fullstack`

### **Phase 5: Advanced Features** (Not Started)
**Priority**: LOW

1. ⬜ Real-time WebSocket updates
2. ⬜ ML price prediction
3. ⬜ Push notifications
4. ⬜ Advanced analytics
5. ⬜ **Test with webapp-testing skill**
6. ⬜ Commit and push

**Recommended Skills**: `senior-ml-engineer`, `senior-data-scientist`

### **Phase 6: Deployment** (Not Started)
**Priority**: LOW

1. ⬜ Docker containerization
2. ⬜ CI/CD pipeline setup
3. ⬜ Production hosting (AWS/Heroku)
4. ⬜ Monitoring and logging
5. ⬜ **Test with webapp-testing skill**
6. ⬜ Deploy

**Recommended Skill**: `senior-devops`

---

## 📝 Data Sources Status

### **Government Sources** (Not Integrated)
| Source | URL | Status | Priority |
|--------|-----|--------|----------|
| HARTI | https://www.harti.gov.lk/... | ❌ Not integrated | HIGH |
| CBSL | https://www.cbsl.gov.lk/... | ❌ Not integrated | MEDIUM |
| Statistics Dept | https://www.statistics.gov.lk/... | ❌ Not integrated | MEDIUM |

### **Commercial Sources** (Not Integrated)
| Source | URL | Status | Priority |
|--------|-----|--------|----------|
| Lassana Vegetables | https://lassana.com/... | ❌ Not integrated | MEDIUM |
| Lassana Fruits | https://lassana.com/... | ❌ Not integrated | MEDIUM |
| Keells Meat | https://www.keellssuper.com/... | ❌ Not integrated | LOW |
| Lassana Rice | https://lassana.com/... | ❌ Not integrated | LOW |

### **API Sources** (Optional)
| Source | URL | Status | Priority |
|--------|-----|--------|----------|
| MealDB | https://www.themealdb.com/api/... | ✅ Integrated | LOW |

---

## 🐛 Known Issues

### **1. No Backend** ⚠️
**Impact**: High
**Description**: Application uses mock data only
**Solution**: Implement backend (see Phase 1)

### **2. No Real-time Updates** ⚠️
**Impact**: Medium
**Description**: Price updates are simulated with setTimeout
**Solution**: Implement WebSocket server

### **3. No User Authentication** ⚠️
**Impact**: Medium
**Description**: Shopping lists stored in LocalStorage (lost on browser clear)
**Solution**: Implement user authentication and database storage

### **4. No Data Persistence** ⚠️
**Impact**: Medium
**Description**: All data lost on page refresh
**Solution**: Implement database

### **5. Limited Product Data** ⚠️
**Impact**: Low
**Description**: Only 11 products available
**Solution**: Add more products or integrate real data sources

---

## 📊 Performance & Optimization

### **Current Performance**
- **Page Load**: Fast (static files only)
- **Interactivity**: Smooth animations
- **Mobile**: Responsive design implemented
- **Bundle Size**: Not optimized (using CDN libraries)

### **Optimization Needed**
- ⬜ Implement code splitting
- ⬜ Lazy loading for images
- ⬜ Service Worker for offline support
- ⬜ Progressive Web App (PWA)
- ⬜ Bundle size optimization

**Recommended Skill**: `web-browser`, `senior-frontend`

---

## 🔒 Security Considerations

### **Current Security Status**
- ⚠️ No authentication
- ⚠️ No input validation on backend (no backend exists)
- ⚠️ Client-side data only (exposed)
- ⚠️ No HTTPS enforcement
- ⚠️ No rate limiting
- ⚠️ No CORS configuration

### **Security Tasks Needed**
- ⬜ Implement authentication (JWT)
- ⬜ Input validation and sanitization
- ⬜ HTTPS enforcement
- ⬜ Rate limiting
- ⬜ CORS configuration
- ⬜ SQL injection prevention
- ⬜ XSS protection
- ⬜ CSRF tokens

**Recommended Skill**: `senior-security`

---

## 📖 Design System

### **Color Palette**
```css
--forest-green: #2D5016    /* Primary brand color */
--sage-green: #87A96B       /* Secondary green */
--warm-beige: #F5F1E8       /* Background */
--deep-brown: #8B4513       /* Text */
--harvest-gold: #DAA520     /* Accents */
--crimson-red: #DC143C      /* Price increases */
--sky-blue: #87CEEB         /* Info */
```

### **Typography**
- **Primary**: Inter (sans-serif)
- **Display**: Playfair Display (serif)
- **Monospace**: JetBrains Mono

### **Design Docs**
See `design.md` for complete design system documentation

---

## 🧪 Testing Strategy

### **Current Testing**
- ❌ No automated tests
- ❌ No unit tests
- ❌ No integration tests
- ❌ No E2E tests

### **Testing Needed**

#### **Frontend Testing**
```javascript
// Unit Tests (Not implemented)
- test('Product card renders correctly')
- test('Search filters products')
- test('Shopping list adds items')
- test('Price adjustment updates display')

// Integration Tests (Not implemented)
- test('Filter + Search works together')
- test('Shopping list + Price calculation')

// E2E Tests (Not implemented)
- test('User journey: Add to shopping list')
- test('User journey: Compare prices')
- test('User journey: Set price alert')
```

#### **Backend Testing** (When implemented)
```javascript
// API Tests (Not implemented)
- test('GET /api/products returns all products')
- test('POST /api/alerts creates alert')
- test('Authentication middleware works')
```

**Recommended Skills**:
- `webapp-testing` (REQUIRED before all commits)
- `senior-qa` (test strategy)
- `playwright-skill` (E2E testing)

---

## 💾 Git Workflow

### **Current Branch**
`claude/market-price-tracker-01HRDGZdW3WQ7rfUb1RCfw1F`

### **Commit History**
```
4184f0b - Fix product grid not displaying on index page
ba4277e - Add comprehensive skills documentation
431945f - add source
8ef5593 - Initial commit
```

### **Git Protocol** ⚠️
1. Make changes
2. **Test with webapp-testing skill** ✅
3. Stage changes: `git add -A`
4. Commit with descriptive message
5. Push to remote: `git push -u origin <branch-name>`

### **Commit Message Format**
```
Short summary (50 chars or less)

- Detailed bullet points of changes
- What was fixed/added
- Why it was necessary

Fixes: #issue-number (if applicable)
```

---

## 🤝 Collaboration Notes

### **For Future Developers**

#### **Getting Started**
1. Clone repository
2. Open `index.html` in browser (no build required)
3. Check `CLAUDE.md` (this file) for status
4. Review `SKILLS_GUIDE.md` for available tools

#### **Making Changes**
1. Read `project_outline.md` for requirements
2. Check `interaction.md` for UX guidelines
3. Follow `design.md` for styling
4. **Test with webapp-testing skill before committing** ⚠️

#### **Backend Development**
1. Set up Node.js/Express or Python/FastAPI
2. Create PostgreSQL database
3. Follow REST API best practices
4. Use skills: `senior-fullstack`, `senior-backend`
5. **Test with webapp-testing skill** ⚠️

---

## 📞 Quick Reference

### **Start Development**
```bash
# No build required - static site
# Just open index.html in browser
```

### **Use a Skill**
```
Use the [skill-name] skill to [task]
```

### **Test Before Commit** ⚠️
```
Use the webapp-testing skill to test [feature]
```

### **Commit Changes**
```bash
git add -A
git commit -m "Description"
git push -u origin claude/market-price-tracker-01HRDGZdW3WQ7rfUb1RCfw1F
```

---

## 📌 Important Files

| File | Purpose | Status |
|------|---------|--------|
| `CLAUDE.md` | This documentation | ✅ Current |
| `SKILLS_GUIDE.md` | Detailed skills docs | ✅ Complete |
| `QUICK_SKILLS_REFERENCE.md` | Quick skills reference | ✅ Complete |
| `project_outline.md` | Project specifications | ✅ Complete |
| `interaction.md` | UX/interaction design | ✅ Complete |
| `design.md` | Design system guide | ✅ Complete |
| `README.md` | Project readme | ❌ Not created |

---

## 🎯 Summary

**Current State**: Functional frontend-only application with mock data
**Testing Protocol**: ✅ **MUST use webapp-testing skill before all commits**
**Backend Status**: ❌ Not implemented - requires full backend development
**Next Priority**: Build backend API or web scraper

**Recommended Next Action**:
```
Use the senior-fullstack skill to build a Node.js/Express backend API
with PostgreSQL database for the market price tracker
```

---

**Last Updated**: 2025-11-19
**Maintained By**: Claude (Anthropic)
**Project Status**: Active Development - Frontend Complete, Backend Needed
