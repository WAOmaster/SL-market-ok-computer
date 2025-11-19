# Market Price App - Design Style Guide

## Design Philosophy

### Visual Language
**Modern Agricultural Aesthetic**: Clean, earthy design that reflects the natural origins of produce while maintaining professional data visualization standards. The design evokes trust, freshness, and reliability - essential qualities for a price tracking application.

### Color Palette
**Primary Colors**:
- **Forest Green** (#2D5016): Primary brand color, represents freshness and growth
- **Sage Green** (#87A96B): Secondary green for accents and highlights
- **Warm Beige** (#F5F1E8): Background color, represents natural earth tones
- **Deep Brown** (#8B4513): Text color and borders, represents soil and stability

**Accent Colors**:
- **Harvest Gold** (#DAA520): Price increase indicators and call-to-action buttons
- **Crimson Red** (#DC143C): Price decrease indicators and alerts
- **Sky Blue** (#87CEEB): Neutral information and secondary buttons

### Typography
**Primary Font**: "Inter" - Clean, modern sans-serif for excellent readability across devices
**Display Font**: "Playfair Display" - Elegant serif for headings and brand elements
**Monospace Font**: "JetBrains Mono" - For price displays and numerical data

**Hierarchy**:
- **H1**: 32px Playfair Display, Forest Green
- **H2**: 24px Inter Bold, Deep Brown
- **H3**: 18px Inter Semibold, Deep Brown
- **Body**: 16px Inter Regular, Deep Brown
- **Price Display**: 20px JetBrains Mono Bold, Forest Green

## Visual Effects and Styling

### Used Libraries and Effects

**Core Animation Library**: Anime.js for smooth, performant animations
**Data Visualization**: ECharts.js for interactive price charts and trend analysis
**Visual Effects**: Custom CSS animations with Anime.js integration
**Image Processing**: Subtle hover effects using CSS transforms

### Header and Navigation Effects
**Floating Navigation Bar**: Semi-transparent background with backdrop blur effect
**Smooth Transitions**: 300ms ease-in-out transitions for all interactive elements
**Active State Indicators**: Subtle glow effect using box-shadow for current page

### Card and Component Styling
**Price Cards**: 
- Clean white background with subtle shadow
- Hover effect: 3D tilt using CSS transforms
- Price change indicators with animated arrow icons
- Smooth color transitions for price status updates

**Interactive Elements**:
- Buttons: Gradient backgrounds with hover lift effects
- Dropdown menus: Smooth slide-down animations
- Toggle switches: Satisfying click animations with color transitions

### Background and Layout
**Consistent Background**: Warm beige (#F5F1E8) maintained throughout all pages
**Decorative Elements**: Subtle geometric patterns inspired by agricultural themes
**Grid System**: Responsive CSS Grid layout for optimal viewing across devices

### Data Visualization Styling
**Chart Aesthetics**:
- Clean, minimal design with subtle grid lines
- Color-coded data series using palette colors
- Smooth animation transitions for data updates
- Interactive tooltips with price information

**Price Trend Indicators**:
- Animated arrow icons for price changes
- Color-coded status (green for decrease, red for increase)
- Pulsing animation for significant price movements

### Image and Media Treatment
**Hero Images**: High-quality produce photography with natural lighting
**Product Images**: Consistent aspect ratios with subtle border radius
**Icon System**: Custom SVG icons representing different produce categories

### Responsive Design Principles
**Mobile-First Approach**: Optimized for touch interactions and small screens
**Flexible Layouts**: CSS Grid and Flexbox for adaptive content arrangement
**Scalable Typography**: Fluid type scale that adjusts to screen size
**Touch-Friendly**: Minimum 44px touch targets for all interactive elements

### Accessibility Considerations
**High Contrast**: All text maintains 4.5:1 contrast ratio minimum
**Focus Indicators**: Clear visual focus states for keyboard navigation
**Screen Reader Support**: Semantic HTML structure and ARIA labels
**Color Independence**: Information conveyed through multiple visual cues, not just color

## Animation and Interaction Design

### Micro-Interactions
**Button Hover**: Subtle scale transform (1.05x) with shadow increase
**Card Interactions**: 3D perspective tilt on hover with smooth transitions
**Loading States**: Elegant skeleton screens with subtle pulse animation
**Form Feedback**: Real-time validation with smooth color transitions

### Page Transitions
**Smooth Navigation**: Fade transitions between pages using CSS animations
**Content Loading**: Staggered animation for price cards and data displays
**Scroll Animations**: Subtle reveal animations as content enters viewport

### Data Update Animations
**Price Changes**: Smooth number counting animations for price updates
**Chart Transitions**: Fluid data point movements when switching time periods
**Filter Applications**: Smooth filtering animations with fade in/out effects