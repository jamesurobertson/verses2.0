# Verses - Bible Memory App

A modern React TypeScript application for Bible verse memorization using spaced repetition methodology.

## Overview

This is a Progressive Web App (PWA) designed to help users memorize Bible verses through:
- **Spaced repetition system** with progressive review intervals (daily → weekly → biweekly → monthly)
- **Swipeable card interface** optimized for mobile interaction
- **User authentication** and cloud sync via Supabase
- **Dual-write architecture** for offline-first functionality with automatic cloud sync
- **ESV API integration** for verse content

### Dual-Write Architecture

The app uses an innovative **offline-first dual-write architecture** that provides seamless functionality regardless of network connectivity:

- **Local-First Storage**: All data is immediately saved to IndexedDB using Dexie for instant app responsiveness
- **Automatic Cloud Sync**: Changes are automatically synced to Supabase when network is available
- **Graceful Degradation**: App continues working fully offline; syncs when connection is restored
- **Conflict Resolution**: Local data takes precedence with remote sync as enhancement, not requirement

This approach ensures users can add verses, practice memorization, and track progress even without internet connection, while still benefiting from cloud backup and cross-device synchronization when online.

*See [docs/dexie-overview.md](docs/dexie-overview.md) for detailed technical documentation.*

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4.x
- **Animations**: Framer Motion
- **Database**: Supabase (PostgreSQL)
- **Local Storage**: Dexie (IndexedDB wrapper)
- **Testing**: Jest + React Testing Library
- **Build**: Vite with TypeScript

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── Button/         # Styled button component
│   ├── MobileNavigation/ # Mobile-optimized navigation
│   ├── VerseCard/      # Individual verse display card
│   └── VerseStack/     # Stack of review cards with gestures
├── contexts/           # React context providers
│   └── AppContext.tsx  # Global app state management
├── hooks/             # Custom React hooks
│   ├── useAuth.ts     # Authentication logic
│   ├── useReview.ts   # Review session management
│   └── useVerses.ts   # Verse data operations
├── pages/             # Route components
│   ├── AddVerse/      # Add new verses to memorize
│   ├── Auth/          # Login/signup
│   ├── Library/       # View all saved verses
│   ├── Review/        # Active memorization session
│   └── Settings/      # User preferences
├── services/          # External API integrations
│   ├── esvApi.ts      # ESV Bible API client
│   └── supabase.ts    # Database client & types
├── types/             # TypeScript type definitions
│   └── verse.ts       # Core data models
├── utils/             # Helper functions
│   ├── bibleRefParser.ts    # Parse "John 3:16" format
│   ├── env.ts              # Environment validation
│   ├── sanitization.ts     # Input sanitization
│   ├── security.ts         # Security utilities
│   └── spacedRepetition.ts # SRS algorithm logic
└── router/            # Route configuration
    └── AppRouter.tsx   # Main routing setup
```

### Database Schema
- **user_profiles**: User settings and preferences
- **verses**: Shared verse content cache
- **verse_cards**: User's personal memorization progress

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run type-check` - TypeScript type checking

### Environment Variables
Create a `.env.local` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_ESV_API_KEY=your_esv_api_key
```

## Features

### Core Functionality
- **Verse Management**: Add, edit, archive Bible verses
- **Spaced Repetition**: Automatic scheduling based on review performance
- **Review Sessions**: Interactive card-based memorization
- **Progress Tracking**: Streaks, success rates, and statistics
- **Offline Support**: Works without internet connection

### User Experience
- **Mobile-First Design**: Optimized for phone usage
- **Gesture Controls**: Swipe for correct/incorrect responses
- **PWA Support**: Install as native app
- **Responsive Layout**: Works on all screen sizes

### Security & Data
- **Input Sanitization**: All user inputs are sanitized
- **Authentication**: Secure user accounts via Supabase Auth
- **Data Validation**: Zod schemas for type-safe data handling
- **Privacy**: User data stored securely with proper access controls

## Testing

The project uses Test-Driven Development (TDD) with comprehensive test coverage:
- **Unit Tests**: Individual functions and components
- **Integration Tests**: Full workflows and user interactions
- **Infrastructure Tests**: Database connections and API integrations

Test files mirror the source structure in the `/tests` directory.

## Deployment

The app is built as a static site and can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

The PWA manifest enables installation on mobile devices and desktop browsers.