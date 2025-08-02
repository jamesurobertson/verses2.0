# Design System - Verses 2.0

This document outlines the design system for the Verses Bible memorization app. Use these guidelines when implementing new pages and components.

## Color Palette

### Primary Colors
- **Primary**: `#1C2A39` (Deep navy) - Use for headers, primary text, navigation icons
- **Accent**: `#E3B23C` (Warm gold) - Use for primary buttons, highlights, active states
- **Background**: `#FAF9F6` (Off-white) - Use for page backgrounds, cards

### Status Colors
- **Success**: `#3CB371` (Gentle green) - Use for correct review results, success states
- **Error**: `#FF6F61` (Soft coral) - Use for needs work results, error states

### Usage in Code

#### Tailwind Classes
```css
/* Primary Colors */
text-primary, bg-primary, border-primary
text-accent, bg-accent, border-accent
text-background, bg-background, border-background

/* Status Colors */
text-success, bg-success, border-success
text-error, bg-error, border-error
```

#### CSS Variables
```css
/* For custom CSS when Tailwind classes aren't sufficient */
var(--color-primary)
var(--color-accent)
var(--color-background)
var(--color-success)
var(--color-error)
```

## Typography

### Font Families
- **Roboto**: Default font for all UI elements (navigation, buttons, labels, etc.)
- **Crimson Text**: Specifically for Bible verse content

### Typography Hierarchy
- **Page titles**: `text-3xl font-bold text-primary` (large, prominent headers)
- **Section headers**: `font-medium text-primary text-lg` (book names, categories)
- **Body text**: `text-base font-medium text-primary` (main content like verse references)
- **Secondary text**: `text-sm text-primary/60` (supporting info, descriptions)
- **Bible content**: `font-crimson` (Crimson Text font for actual verse text)

### Usage in Code

#### Tailwind Classes
```css
font-roboto    /* For all UI elements (default on body) */
font-crimson   /* For Bible verse text only */
```

#### Implementation Example
```jsx
// Page title
<h1 className="text-3xl font-bold text-primary mb-4">Library</h1>

// Section header
<h2 className="font-medium text-primary text-lg">Romans</h2>

// Regular UI text (uses Roboto by default)
<p className="text-base font-medium text-primary">John 3:16</p>

// Secondary text
<p className="text-sm text-primary/60">Supporting information</p>

// Bible verse content (use Crimson Text)
<p className="font-crimson text-primary">
  "For God so loved the world that he gave his one and only Son..."
</p>
```

## Layout Structure

### Page Layout Pattern
```jsx
<div className="min-h-screen bg-background">
  {/* Sticky Header */}
  <div className="sticky top-0 z-10 bg-white">
    <div className="max-w-6xl mx-auto px-4 pt-6 sm:px-6 lg:px-8">
      {/* Header content */}
    </div>
  </div>
  
  {/* Scrollable Content */}
  <div className="max-w-6xl mx-auto px-4 pt-6 pb-8 sm:px-6 lg:px-8">
    {/* Page content */}
  </div>
</div>
```

### Layout Principles
- **Sticky headers**: Use `sticky top-0 z-10 bg-white` for headers that stay visible when scrolling
- **Full-width containers**: `min-h-screen bg-background` for full page coverage
- **Responsive padding**: `px-4 pt-6 sm:px-6 lg:px-8` that scales from mobile to desktop
- **Content constraints**: `max-w-6xl mx-auto` to prevent overly wide content on large screens

## Interactive Elements

### Tab Navigation Pattern
```jsx
<div className="flex border-b border-primary/20">
  <button className={`px-4 py-3 font-medium transition-all duration-300 ease-in-out border-b-2 ${
    isActive ? 'text-primary border-accent' : 'text-primary/60 hover:text-primary/80 border-transparent'
  }`}>
    Tab Name
  </button>
</div>
```

### Button Patterns
```jsx
// Primary action
<button className="bg-accent text-white px-4 py-3 rounded-lg font-medium hover:bg-accent/90 transition-all duration-200">
  Primary Action
</button>

// Secondary action  
<button className="text-primary hover:bg-primary/5 px-4 py-3 rounded-lg font-medium transition-all duration-200">
  Secondary Action
</button>
```

### Interactive States
- **Hover states**: Subtle `hover:bg-primary/5` background highlights
- **Touch targets**: `px-4 py-3` for comfortable 44px minimum touch targets
- **Smooth transitions**: `transition-all duration-300 ease-in-out` for polished interactions

## Spacing & Animation

### Spacing Patterns
- **Section spacing**: `mb-4` for headers, `mb-6` for major sections
- **List spacing**: `space-y-2` for tight lists, `space-y-4` for more breathing room
- **Content padding**: `pt-6 pb-8` for main content areas
- **Bottom padding**: Always include `pb-8` to prevent content cutoff

### Animation Standards
- **Fast interactions**: `duration-200` for hovers and clicks
- **Content transitions**: `duration-300` for tabs, dropdowns
- **Smooth easing**: `ease-in-out` for natural motion
- **Staggered reveals**: 50ms delays for cascading animations

## Mobile-First Design

### Principles
- **Touch-friendly**: 44px minimum touch targets
- **Clean minimal design**: No borders/shadows unless necessary
- **Efficient spacing**: Tight but comfortable spacing for mobile
- **Progressive enhancement**: Larger spacing on bigger screens

### Responsive Breakpoints
- **Mobile**: Base styles, `px-4` padding
- **Tablet**: `sm:px-6` increased padding
- **Desktop**: `lg:px-8` maximum padding

## Component Patterns

### Accordion/Dropdown Pattern
```jsx
<div className="space-y-2">
  <button className="w-full px-4 py-3 text-left hover:bg-primary/5 transition-all duration-200 ease-in-out flex items-center justify-between rounded-lg">
    <span className="font-medium text-primary">Section Title</span>
    <svg className="w-5 h-5 text-primary/40 transition-all duration-300 ease-in-out transform rotate-0">
      {/* Arrow icon */}
    </svg>
  </button>
  
  <div className="overflow-hidden transition-all duration-300 ease-in-out max-h-screen opacity-100">
    {/* Expandable content */}
  </div>
</div>
```

### List Item Pattern
```jsx
<button className="w-full px-4 py-3 text-left hover:bg-primary/5 transition-all duration-200 ease-in-out flex items-center justify-between rounded-lg">
  <div className="flex-1 min-w-0">
    <h4 className="text-base font-medium text-primary mb-1">Main Text</h4>
    <p className="text-sm text-primary/60 truncate">Secondary text</p>
  </div>
  <div className="ml-4 text-primary/40">
    {/* Icon or indicator */}
  </div>
</button>
```

## Detailed UI Guidelines

### 1. Visual Hierarchy & Readability
- **Increase padding** around verse text on both Review and Library detail screens for breathing room and premium feel
- **Use larger font size** for references (front of card) so they feel like a focal point
- **Ensure line length** for verse text is optimal (about 50–75 characters per line) for memorization readability

### 2. Button Styling
- **Replace default blue** buttons with warm gold accent (#E3B23C) to align with palette
- **Use full-width buttons** with rounded corners for touch comfort
- **Keep primary action at bottom** to align with thumb reach on mobile

### 3. Tally Marks
- **Slightly fade inactive** tally marks so users instantly see progress
- **Place tally marks in the top left corner of** front card for subtle design.

### 4. Library Improvements
- **Make book titles sticky headers** when scrolling
- **Add subtle divider line** or shadow between groups to improve scanning
- **Add tap feedback** (light ripple or highlight) when a verse is clicked

### 5. Card Styling
- **Soft elevation + rounded corners** with:
  - Very subtle border in light gray to help cards pop in bright light
  - Directionless soft ambient shadow for floating card feel

### 6. Navigation
- **Use filled icons** for active tab, outlined for inactive (better visual state clarity)
- **Include labels under icons** for clarity in MVP
- **Match spacing and styling** across all navigation elements

### 7. Consistency Rules
- **Match corner radius and padding** across all screens
- **Consistent spacing** for input fields, dropdowns, headers
- **Same spacing rules** for top headers on every screen

## Notes for Implementation

- Each page should implement its own components following these patterns
- Maintain consistency across all pages using these established colors and fonts
- Test color combinations for accessibility compliance
- Use Crimson Text sparingly and only for Bible content to maintain hierarchy
- Default body font is already set to Roboto, so most elements inherit it automatically
- Reference the mockup image at `/Users/jamesrobertson/Downloads/ChatGPT Image Aug 2, 2025, 10_17_02 AM.png` for visual guidance