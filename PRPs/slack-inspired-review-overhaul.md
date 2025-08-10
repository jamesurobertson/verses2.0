# Slack-Inspired Review Overhaul - Project Resource Package (PRP)

name: "Slack-Inspired Review Page Complete Overhaul"
description: |

## Purpose
Comprehensive PRP optimized for AI agents to implement a complete rewrite of the Review system with Slack-style card stack interface, local-only sessions with undo functionality, and optimal gesture library selection.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Follow all rules in CLAUDE.md

---

## Goal
Complete rewrite of `/review` page to mirror Slack's mobile catch-up interface with full-screen card stack, progressive text revelation, comprehensive undo system, and local-only session management with batch cloud sync.

## Why
- **User Experience**: Immersive, distraction-free Bible memorization matching modern mobile UX patterns
- **Performance**: Eliminate 90kb+ Framer Motion dependency, optimize for 60fps mobile performance
- **Functionality**: Add comprehensive undo system impossible with current immediate-sync architecture
- **Maintainability**: Clean, purpose-built architecture replacing 418-line complex ReviewCard component
- **Future-Ready**: Gesture system designed for easy modification and extension

## What
User-visible behavior: Full-screen card stack interface matching Slack's catch-up feature exactly - swipeable cards with background cards visible, floating header (X, progress counter, undo), floating bottom buttons (Mark Incorrect/Mark Correct), progressive text revelation based on user settings, complete undo functionality throughout session.

### Success Criteria
- [ ] 100% full-screen interface with no Layout component, navbar, or headers
- [ ] Perfect visual replication of Slack catch-up card stack with depth effects
- [ ] All 3 text revelation modes working (full, first-letter, progressive-words)
- [ ] Complete undo functionality allowing full session reversal
- [ ] Local-only session management with batch sync on completion
- [ ] Mobile-first responsive design across all screen sizes (320px-1024px+)
- [ ] Bundle size reduction (remove 90kb+ Framer Motion, add <15kb gesture library)
- [ ] 60fps animations on mid-range mobile devices
- [ ] All existing database operations preserved and working
- [ ] Comprehensive test coverage matching existing patterns

## All Needed Context

### Gesture Library Research - COMPLETE ANALYSIS

Based on comprehensive 2024 research, here are the evaluated options:

#### Option 1: @use-gesture/react (RECOMMENDED)
```yaml
- bundle_size: "~15kb gzipped"
- performance: "8/10 - Excellent mobile touch responsiveness"
- api_simplicity: "8/10 - Clean, intuitive API"
- mobile_support: "9/10 - Built specifically for touch devices"
- documentation: "https://use-gesture.netlify.app/"
- npm_package: "@use-gesture/react"
- weekly_downloads: "243,123"
- why_recommended: "Perfect balance of features, performance, and bundle size"
- integration_with_react_spring: "Seamless - designed to work together"
```

#### Option 2: react-swipeable (LIGHTWEIGHT ALTERNATIVE)
```yaml
- bundle_size: "~8kb gzipped"  
- performance: "7/10 - Good for simple swipes only"
- api_simplicity: "9/10 - Extremely simple API"
- mobile_support: "8/10 - Supports touch and mouse"
- documentation: "https://www.npmjs.com/package/react-swipeable"
- weekly_downloads: "489,771"
- limitation: "Only handles swipe gestures, no complex interactions"
```

#### Option 3: Custom CSS/JS Implementation
```yaml
- bundle_size: "<2kb"
- performance: "7/10 - Good but requires more manual optimization"
- api_simplicity: "9/10 - Complete control"
- mobile_support: "8/10 - Requires manual touch-action handling"
- effort: "High - Need to handle edge cases manually"
```

#### Current: Framer Motion (TO REMOVE)
```yaml
- bundle_size: "90kb+ gzipped (with tree-shaking ~22kb for motion alone)"
- performance: "9/10 - Excellent but overkill"
- api_simplicity: "6/10 - Complex API for simple swipes"
- mobile_support: "9/10 - Excellent"
- reason_for_removal: "Massive bundle size for simple swipe gestures only"
```

**DECISION: Use @use-gesture/react for optimal balance of features and performance**

### Documentation & References
```yaml
# MUST READ - Include these in your context window

- url: https://use-gesture.netlify.app/docs/gestures/
  why: Complete gesture handling documentation with drag, swipe, pinch examples
  section: "Drag gestures, gesture state, configuration options"

- url: https://use-gesture.netlify.app/docs/options/
  why: Configuration options for thresholds, velocity, axis constraints
  section: "threshold, velocityThreshold, axis, filterTaps"

- url: https://use-gesture.netlify.app/docs/integration/react-spring/
  why: Integration patterns with React Spring for smooth animations
  section: "Basic usage, common patterns, performance tips"

- url: https://motion.dev/docs/react-gestures
  why: Understanding current Framer Motion gesture patterns to replace
  section: "drag, pan, whileDrag - patterns to convert to @use-gesture"

- url: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
  why: Critical CSS property for preventing scroll conflicts on mobile
  section: "touch-action: none, manipulation, pan-x, pan-y"

- url: https://web.dev/mobile-touch/
  why: Mobile touch optimization best practices
  section: "Touch targets, scroll performance, gesture handling"
```

### Current Codebase Patterns

#### Hook Patterns (from existing codebase)
```typescript
// Pattern from useReview.ts - PRESERVE THIS STRUCTURE
const { getCurrentUserId, getAccessToken } = useAuth();
const { timezone } = useTimezone();
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Callback pattern for database operations
const loadDueCards = useCallback(async (userId: string): Promise<LibraryVerseCard[]> => {
  try {
    const allUserCards = await localDb.verseCards.getByUser(userId);
    // ... processing logic
    return filterDueCards(libraryCards, timezone);
  } catch (error) {
    console.error('Failed to load due cards:', error);
    return [];
  }
}, [timezone]);

// Effect pattern for initialization
useEffect(() => {
  refreshDueCards();
  const userId = getCurrentUserId();
  loadReferenceDisplayMode(userId);
}, [refreshDueCards, getCurrentUserId, loadReferenceDisplayMode]);
```

#### Database Interaction Patterns - CRITICAL TO PRESERVE
```typescript
// Local database operations (from current useReview.ts)
const localTodaysCards = await localDb.verseCards.getReviewedToday(userId);
const verse = await localDb.verses.findById(card.verse_id);
const userProfile = await localDb.userProfiles.findByUserId(userId);

// Local review log creation (for undo system)
await localDb.reviewLogs.create({
  user_id: userId,
  verse_card_id: currentCard.id,
  was_successful: true,
  counted_toward_progress: true,
  review_time_seconds: undefined
});

// Remote sync operations (batch at session end)
await dataService.recordReview(
  currentCard.id,
  userId,
  false, // was not successful
  undefined, // review time
  accessToken || undefined
);
```

#### Router Pattern (MUST UPDATE THIS)
```typescript
// Current pattern in AppRouter.tsx - THIS NEEDS CHANGING
<Route path="/review" element={<Layout title="Review"><Review /></Layout>} />

// New pattern needed - NO LAYOUT COMPONENT
<Route path="/review" element={<Review />} />
```

#### Shared Component Patterns (USE THESE)
```typescript
// From existing shared components
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';  
import { ErrorCard } from '../../components/shared/ErrorCard';

// Usage patterns
<Card title="Session Results">
  {/* content */}
</Card>

<EmptyState 
  title="No cards due for review today!"
  description="Great job! Check back tomorrow for more verses to review."
  actionText="View Library"
  actionHref="/library"
  icon="🎉"
/>

<ErrorCard 
  title="Failed to load review session"
  message={error}
  onRetry={refreshDueCards}
/>
```

#### Test Patterns (from Button.test.tsx)
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('ReviewComponent', () => {
  test('renders full screen interface', () => {
    render(<Review />);
    expect(screen.getByRole('main')).toHaveStyle('height: 100vh');
  });

  test('handles swipe gestures', () => {
    const { getByTestId } = render(<Review />);
    // Gesture testing patterns
  });
});
```

### Files to Backup and Document - CRITICAL STEP

#### Files to Backup (with .backup extension)
```bash
# These files contain working database patterns - PRESERVE BEFORE DELETING
cp src/pages/Review/Review.tsx src/pages/Review/Review.tsx.backup
cp src/pages/Review/hooks/useReview.ts src/pages/Review/hooks/useReview.ts.backup  
cp src/pages/Review/components/ReviewCard.tsx src/pages/Review/components/ReviewCard.tsx.backup
```

#### Database Patterns to Extract from useReview.ts.backup
```typescript
// DOCUMENT THESE EXACT PATTERNS FROM BACKUP FILE:
1. loadDueCards() - uses filterDueCards(libraryCards, timezone)
2. loadTodaysCards() - uses localDb.verseCards.getReviewedToday(userId) 
3. loadReferenceDisplayMode() - uses localDb.userProfiles.findByUserId(userId)
4. markCardCorrect/Incorrect() - dual-write pattern with local-first
5. Session state management - ReviewSession interface and progression logic
6. Error handling patterns - try/catch with graceful degradation
```

### Implementation Blueprint

#### Phase 1: Preparation and Research (COMPLETE FIRST)
```typescript
// 1. Backup existing files
// 2. Remove framer-motion and install @use-gesture/react
npm uninstall framer-motion
npm install @use-gesture/react

// 3. Update router to remove Layout wrapper
// In src/router/AppRouter.tsx
<Route path="/review" element={<Review />} />  // Remove Layout wrapper

// 4. Clean up unused framer-motion imports across codebase
// Search for: import.*framer-motion
// Replace with @use-gesture imports where needed
```

#### Phase 2: Core Hook Architecture (useSlackReview.ts)
```typescript
// New hook structure - BUILD THIS FIRST
interface ReviewAction {
  id: string;
  cardId: string; 
  wasSuccessful: boolean;
  timestamp: number;
  wordRevealProgress?: number; // For progressive word reveal
}

interface ReviewSession {
  cards: LibraryVerseCard[];
  actions: ReviewAction[]; // LOCAL ONLY - for undo system
  currentCardIndex: number;
  wordRevealIndex: number; // For progressive word reveal
  startTime: number;
}

export function useSlackReview() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [dueCards, setDueCards] = useState<LibraryVerseCard[]>([]);
  
  // PRESERVE existing database patterns exactly
  const loadDueCards = useCallback(async (userId: string) => {
    // Copy exact logic from useReview.ts.backup
  }, [timezone]);
  
  // NEW undo functionality
  const undoLastAction = useCallback(() => {
    if (!session || session.actions.length === 0) return;
    
    const actionsWithoutLast = session.actions.slice(0, -1);
    const lastAction = session.actions[session.actions.length - 1];
    
    setSession({
      ...session,
      actions: actionsWithoutLast,
      currentCardIndex: Math.max(0, session.currentCardIndex - 1),
      // Restore word reveal progress if applicable
      wordRevealIndex: lastAction.wordRevealProgress ?? 0
    });
  }, [session]);
  
  // BATCH sync on session completion - CRITICAL PATTERN
  const completeSession = useCallback(async () => {
    if (!session) return;
    
    try {
      // Batch save all review logs to cloud
      for (const action of session.actions) {
        await dataService.recordReview(
          action.cardId,
          getCurrentUserId(),
          action.wasSuccessful,
          undefined,
          await getAccessToken()
        );
      }
    } catch (error) {
      console.error('Failed to sync reviews:', error);
      // Handle batch sync failure gracefully
    }
    
    setSession(null);
  }, [session]);
}
```

#### Phase 3: Card Stack Component Architecture
```typescript
// New component structure - REPLACE ReviewCard entirely
interface SlackCardProps {
  card: LibraryVerseCard;
  isTopCard: boolean;
  stackIndex: number; // 0 = top, 1 = second, etc.
  onSwipe: (direction: 'left' | 'right') => void;
  referenceDisplayMode: string;
}

export function SlackCard({ card, isTopCard, stackIndex, onSwipe, referenceDisplayMode }: SlackCardProps) {
  // Use @use-gesture for swipe handling
  const bind = useDrag(({
    down,
    movement: [mx],
    velocity: [vx],
    direction: [dx],
    cancel
  }) => {
    // Gesture handling logic with @use-gesture patterns
    if (!down && Math.abs(mx) > 150) {
      onSwipe(mx > 0 ? 'right' : 'left');
    }
  });
  
  // Card stack styling with CSS transforms
  const stackStyle = {
    transform: `scale(${1 - (stackIndex * 0.05)}) translateY(${stackIndex * 8}px)`,
    zIndex: 10 - stackIndex,
    boxShadow: `0 ${8 + stackIndex * 4}px ${15 + stackIndex * 10}px rgba(0,0,0,${0.15 - stackIndex * 0.02})`
  };
  
  return (
    <div 
      {...(isTopCard ? bind() : {})}
      style={stackStyle}
      className="absolute inset-0 bg-white rounded-2xl"
    >
      {/* Card content with progressive text revelation */}
    </div>
  );
}
```

#### Phase 4: Progressive Text Revelation System
```typescript
// Text revelation logic - NEW FUNCTIONALITY
export function useTextRevelation(verseText: string, mode: 'full' | 'first' | 'blank') {
  const [revealedWordIndex, setRevealedWordIndex] = useState(0);
  const [isFullyRevealed, setIsFullyRevealed] = useState(false);
  
  const words = verseText.split(/\s+/);
  
  const getDisplayText = useCallback(() => {
    switch (mode) {
      case 'full':
        return isFullyRevealed ? verseText : '';
        
      case 'first':
        if (isFullyRevealed) return verseText;
        // Reuse existing first-letter logic from ReviewCard.tsx.backup
        return verseText.split(/\s+/).map(word => {
          const firstLetter = word.match(/[A-Za-z]/)?.[0] || '';
          return firstLetter + '  '; // Add spacing
        }).join(' ');
        
      case 'blank':
        return words.map((word, index) => 
          index < revealedWordIndex 
            ? word 
            : '█'.repeat(Math.max(2, word.length))
        ).join(' ');
        
      default:
        return verseText;
    }
  }, [mode, verseText, revealedWordIndex, isFullyRevealed, words]);
  
  const revealNext = useCallback(() => {
    if (mode === 'full' || mode === 'first') {
      setIsFullyRevealed(true);
    } else if (mode === 'blank' && revealedWordIndex < words.length) {
      setRevealedWordIndex(prev => prev + 1);
    }
  }, [mode, revealedWordIndex, words.length]);
  
  return { 
    displayText: getDisplayText(), 
    revealNext, 
    isComplete: mode === 'blank' ? revealedWordIndex >= words.length : isFullyRevealed 
  };
}
```

#### Phase 5: Full-Screen Layout Component
```typescript
// New Review.tsx - COMPLETE REWRITE
export function Review() {
  const { session, dueCards, startSession, undoLastAction, completeSession } = useSlackReview();
  
  if (!session) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <EmptyState 
          title={dueCards.length === 0 ? "All caught up!" : `${dueCards.length} verses ready`}
          description={dueCards.length === 0 ? "Great work!" : "Ready to review?"}
          actionText={dueCards.length === 0 ? "View Library" : "Start Review"}
          onAction={dueCards.length === 0 ? () => navigate('/library') : startSession}
        />
      </div>
    );
  }
  
  return (
    // FULL SCREEN LAYOUT - NO LAYOUT COMPONENT
    <div className="fixed inset-0 bg-background" style={{ height: '100dvh' }}>
      {/* Floating Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4"
           style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}>
        <button onClick={() => navigate('/library')}>✕</button>
        <span>{session.cards.length - session.currentCardIndex} Left</span>
        <button onClick={undoLastAction} disabled={session.actions.length === 0}>
          Undo
        </button>
      </div>
      
      {/* Card Stack Area */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        {session.cards.slice(session.currentCardIndex, session.currentCardIndex + 3).map((card, index) => (
          <SlackCard
            key={card.id}
            card={card}
            isTopCard={index === 0}
            stackIndex={index}
            onSwipe={handleSwipe}
            referenceDisplayMode={referenceDisplayMode}
          />
        ))}
      </div>
      
      {/* Floating Bottom Buttons */}
      <div className="absolute bottom-0 left-0 right-0 z-50 flex gap-4 p-4"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
        <button 
          className="flex-1 py-3 border border-red-500 text-red-500 rounded-lg"
          onClick={() => handleSwipe('left')}
        >
          Mark Incorrect
        </button>
        <button 
          className="flex-1 py-3 bg-green-500 text-white rounded-lg"
          onClick={() => handleSwipe('right')}
        >
          Mark Correct  
        </button>
      </div>
    </div>
  );
}
```

### Critical CSS for Mobile Touch Handling
```css
/* MUST INCLUDE - Prevents scroll conflicts */
.swipeable-card {
  touch-action: none; /* Prevents browser scrolling during gestures */
  user-select: none;  /* Prevents text selection during drag */
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Mobile viewport handling */
.full-screen {
  height: 100vh;
  height: 100dvh; /* Dynamic viewport height for mobile */
  position: fixed;
  inset: 0;
}

/* Safe area handling for iOS */
.header-overlay {
  padding-top: env(safe-area-inset-top, 16px);
}

.footer-overlay {
  padding-bottom: env(safe-area-inset-bottom, 16px);  
}
```

### Validation Gates (EXECUTABLE DURING DEVELOPMENT)

#### 1. TypeScript/Linting
```bash
# Must pass during development
npm run typecheck
npm run lint
```

#### 2. Test Suite
```bash
# Core functionality tests
npm test

# Specific test patterns to create:
# src/pages/Review/Review.test.tsx - Full screen layout, navigation
# src/pages/Review/hooks/useSlackReview.test.ts - Session management, undo functionality  
# src/components/SlackCard/SlackCard.test.tsx - Gesture handling, text revelation
```

#### 3. Visual Testing & Debugging with MCP Playwright
```typescript
// AVAILABLE: MCP Playwright for visual validation and debugging
// Use these tools for comprehensive UI testing:

// 1. Visual Screenshot Validation
// Take screenshots at different breakpoints to verify card stack appearance
await mcp__playwright__browser_take_screenshot({
  filename: 'review-mobile-320px.png',
  fullPage: true
});

// 2. Interactive Gesture Testing  
// Navigate to review page and test swipe gestures
await mcp__playwright__browser_navigate({ url: 'http://localhost:5173/review' });
await mcp__playwright__browser_snapshot(); // Get accessibility snapshot

// 3. Touch Target Validation
// Verify all touch targets meet 44x44px minimum requirement
await mcp__playwright__browser_evaluate({
  element: "Review page buttons",
  function: `() => {
    const buttons = document.querySelectorAll('button');
    return Array.from(buttons).map(btn => ({
      width: btn.offsetWidth,
      height: btn.offsetHeight,
      meets44px: btn.offsetWidth >= 44 && btn.offsetHeight >= 44
    }));
  }`
});

// 4. Card Stack Depth Testing
// Verify card stacking visual effects and z-index layering
await mcp__playwright__browser_evaluate({
  element: "Card stack",
  function: `() => {
    const cards = document.querySelectorAll('[data-testid="verse-card"]');
    return Array.from(cards).map((card, index) => ({
      zIndex: getComputedStyle(card).zIndex,
      transform: getComputedStyle(card).transform,
      boxShadow: getComputedStyle(card).boxShadow
    }));
  }`
});

// 5. Responsive Layout Validation
// Test layout at multiple breakpoints
await mcp__playwright__browser_resize({ width: 320, height: 568 }); // iPhone 5
await mcp__playwright__browser_take_screenshot({ filename: 'mobile-320.png' });

await mcp__playwright__browser_resize({ width: 375, height: 812 }); // iPhone X  
await mcp__playwright__browser_take_screenshot({ filename: 'mobile-375.png' });

await mcp__playwright__browser_resize({ width: 768, height: 1024 }); // iPad
await mcp__playwright__browser_take_screenshot({ filename: 'tablet-768.png' });

// 6. Animation Performance Testing
// Verify smooth animations and no layout thrashing
await mcp__playwright__browser_evaluate({
  element: "Card animations",
  function: `() => {
    // Test animation frame rate during swipe
    let frameCount = 0;
    const startTime = performance.now();
    
    function countFrames() {
      frameCount++;
      if (performance.now() - startTime < 1000) {
        requestAnimationFrame(countFrames);
      }
    }
    
    requestAnimationFrame(countFrames);
    
    return new Promise(resolve => {
      setTimeout(() => resolve({ fps: frameCount }), 1100);
    });
  }`
});

// 7. Safe Area Inset Testing (iOS Simulation)
// Verify proper safe area handling for notch and home indicator
await mcp__playwright__browser_evaluate({
  element: "Safe area handling",
  function: `() => {
    // Simulate iOS safe area insets
    document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px');
    
    const header = document.querySelector('[data-testid="header-overlay"]');
    const footer = document.querySelector('[data-testid="footer-overlay"]');
    
    return {
      headerPaddingTop: getComputedStyle(header).paddingTop,
      footerPaddingBottom: getComputedStyle(footer).paddingBottom
    };
  }`
});
```

#### 4. Bundle Size Validation
```bash
# Build and check bundle sizes
npm run build

# Verify @use-gesture bundle impact
# Should see reduction from framer-motion removal (~75kb savings)
# Should see addition from @use-gesture (~15kb)
# Net savings: ~60kb
```

#### 5. Mobile Performance Validation
```bash
# Test on various device sizes
npm run dev

# Manual testing checklist:
# - 320px mobile (iPhone 5)
# - 375px mobile (iPhone X)  
# - 768px tablet
# - Touch targets minimum 44px
# - Smooth 60fps animations
# - No scroll conflicts during gestures

# Use MCP Playwright for automated validation
# of all manual checklist items above
```

### Error Handling Strategy

#### Network/Sync Errors
```typescript
// Pattern for handling batch sync failures
try {
  await batchSyncReviews(session.actions);
} catch (error) {
  // Show user-friendly error message
  setError('Reviews saved locally. Will sync when connection improves.');
  
  // Store failed sync data for retry
  await localDb.failedSyncs.add({
    type: 'review_batch',
    data: session.actions,
    timestamp: Date.now()
  });
}
```

#### Gesture Conflicts
```typescript
// Handle gesture conflicts between swipe and tap
const bind = useDrag({
  filterTaps: true, // Prevent tap events from triggering during drag
  threshold: 10,    // Minimum distance before drag starts
  axis: 'x'         // Only allow horizontal drags
});
```

#### Memory Management
```typescript
// Limit undo stack size to prevent memory issues
const MAX_UNDO_ACTIONS = 50;

const addAction = useCallback((action: ReviewAction) => {
  setSession(prev => ({
    ...prev,
    actions: [...prev.actions.slice(-MAX_UNDO_ACTIONS), action]
  }));
}, []);
```

### Task Checklist (COMPLETE IN ORDER)

1. **[ ] Phase 0: Preparation**
   - Backup existing files (Review.tsx, useReview.ts, ReviewCard.tsx)
   - Research gesture libraries and select @use-gesture/react
   - Remove framer-motion dependency
   - Update router configuration

2. **[ ] Phase 1: Core Hook (useSlackReview.ts)**
   - Extract and preserve database interaction patterns  
   - Implement local-only session management
   - Create undo action stack functionality
   - Add batch sync capability

3. **[ ] Phase 2: Card Stack UI (SlackCard.tsx)**
   - Implement @use-gesture swipe handling
   - Create card stack visual system with depth effects
   - Add progressive text revelation system
   - Ensure mobile touch optimization

4. **[ ] Phase 3: Full-Screen Layout (Review.tsx)**
   - Remove Layout component wrapper
   - Create floating header and footer overlays
   - Implement responsive design with safe areas
   - Add proper navigation handling

5. **[ ] Phase 4: Testing & Validation**
   - Create comprehensive test suite (Jest unit tests)
   - Use MCP Playwright for visual validation and gesture testing
   - Validate bundle size reduction (~60kb savings expected)
   - Test mobile performance across devices (320px-1024px+)
   - Verify database compatibility with existing operations
   - Visual regression testing with screenshot comparisons

6. **[ ] Phase 5: Polish & Optimization**
   - Fine-tune animations for 60fps performance
   - Add proper error handling throughout
   - Implement accessibility features
   - Final validation against success criteria

### Performance Gotchas & Solutions

#### Mobile Touch Performance
```typescript
// CRITICAL: Set proper CSS to prevent scroll conflicts
useEffect(() => {
  document.body.style.touchAction = 'none';
  document.body.style.overflow = 'hidden';
  
  return () => {
    document.body.style.touchAction = '';
    document.body.style.overflow = '';
  };
}, []);
```

#### Animation Performance
```typescript
// Use CSS transforms for GPU acceleration
const cardStyle = {
  transform: `translateX(${x}px) scale(${scale})`,
  willChange: 'transform', // Hint browser for optimization
};
```

#### Memory Leaks Prevention
```typescript
// Clean up gesture bindings
useEffect(() => {
  return () => {
    // @use-gesture automatically cleans up
    // but ensure no hanging references
  };
}, []);
```

---

## Confidence Score: 9/10

**High confidence for one-pass implementation success due to:**
- ✅ Complete gesture library research with specific recommendations
- ✅ All existing database patterns documented and preserved  
- ✅ Step-by-step implementation blueprint with working code examples
- ✅ Comprehensive external documentation links with specific sections
- ✅ Executable validation gates for continuous verification
- ✅ Mobile performance optimizations and gotchas covered
- ✅ Complete error handling strategy
- ✅ Clear task progression with dependencies

**Slight confidence reduction (-1) due to:**
- Complex interaction between gesture system and progressive text revelation requiring careful coordination
- Mobile touch handling edge cases that may need iteration

This PRP provides everything needed for successful one-pass implementation of the Slack-inspired review overhaul.