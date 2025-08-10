# Slack-Inspired Review Page Overhaul - PRD

## Executive Summary

Complete redesign of the `/review` page to mirror Slack's mobile catch-up interface, creating an immersive, full-screen Bible verse review experience with progressive text revelation, undo functionality, and intuitive gesture-based interactions.

## Current State Analysis

### Existing Features That Work Well
- **Swipe gestures**: Functional left/right swipe with visual feedback
- **Dual-write architecture**: Local-first review logging with remote sync
- **Spaced repetition logic**: Solid assignment and progression algorithms
- **Reference display modes**: 3 modes (`full`, `first`, `blank`) already implemented
- **Session management**: Tracks progress, correct/incorrect counts, streak data

### Current Pain Points
- **Layout clutter**: Navbar, title headers, and layout components distract from content
- **Complex UI states**: Multiple screens and flows create cognitive load
- **Limited undo functionality**: No ability to correct mistakes in review session
- **Immediate sync**: Review logs save to cloud immediately, making undo complex
- **Inconsistent fullscreen experience**: Cards don't truly fill the screen

## Goals & Success Criteria

### Primary Goals
1. **Immersive Experience**: Full-screen, distraction-free review environment
2. **Slack Parity**: Visual and interaction patterns matching Slack's catch-up feature  
3. **Progressive Revelation**: Smart text unveiling based on user display mode preferences
4. **Undo System**: Comprehensive ability to reverse review decisions during session
5. **Gesture Optimization**: Maintainable swipe system ready for future enhancements

### Success Metrics
- [ ] 100% full-screen experience (no navbar, headers, or layout components)
- [ ] Perfect visual replication of Slack catch-up interface patterns
- [ ] Seamless undo functionality allowing complete session reversal
- [ ] Progressive text revelation working for all 3 display modes
- [ ] Maintainable swipe gesture system with clear abstraction points
- [ ] Zero review logs saved to cloud until session completion
- [ ] Mobile-optimized touch interactions throughout

## Target User Experience

### Entry Flow
1. User navigates to `/review` from library
2. **Instant full-screen transition** - no loading screens, layout shifts, or UI chrome
3. **Immediate card presentation** - first due verse appears instantly
4. **Contextual guidance** - subtle UI hints show available actions

### Core Review Loop
1. **Verse reference display** - Clear, prominent reference at top
2. **Blurred text state** - Content hidden awaiting user interaction
3. **Progressive revelation** - Tap to reveal based on user's display mode preference:
   - `full`: Single tap reveals entire verse text
   - `first`: Single tap shows first letter of each word
   - `blank`: Progressive tapping reveals one word at a time
4. **Gesture response** - Swipe left (incorrect) or right (correct) with visual feedback
5. **Session progress** - Discrete counter showing remaining cards

### Undo System
1. **Undo button** - Always visible in top-right corner
2. **Step-by-step reversal** - Each tap undoes one review action
3. **Complete session reversal** - Continue undoing to beginning if desired
4. **Local state only** - No cloud sync until session completion

### Session Completion
1. **Results summary** - Final score and encouragement
2. **Batch sync** - All review logs saved to cloud at once
3. **Next actions** - Return to library or start new session

## Detailed Feature Specifications

### 1. Full-Screen Layout Architecture

#### Layout Structure (Mobile-First Card Stack)
```
┌─────────────────────────────────────┐
│ [X]              2 Left      [Undo] │ ← Floating overlay header
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │      JOHN 3:16                │  │ ← Top card (swipeable)
│  │                               │  │
│  │  [Blurred text content]       │  │
│  │  (tap to reveal)              │  │
│  │                               │  │ 
│  │                               │  │
│  └───────────────────────────────┘  │ ← Card 2 visible underneath
│   ┌─────────────────────────────┐   │ ← Card 3 visible underneath  
│                                     │
│                                     │
│ [Mark Incorrect]  [Mark Correct]    │ ← Floating overlay buttons
└─────────────────────────────────────┘
```

#### Layout Requirements
- **No Layout component**: Direct full-screen rendering
- **No navigation bar**: Remove bottom navbar entirely during review  
- **100vh height**: Use full viewport height with proper mobile viewport handling
- **Card stack architecture**: Layered cards with depth/shadow effects like Slack
- **Floating overlays**: Header and buttons float over card stack, no fixed sections
- **Safe area insets**: Proper handling of iOS notch and home indicator
- **Mobile-first responsive**: Optimized for phone screens, scales up to tablets
- **No separator lines**: Clean card-only interface matching Slack design

### 2. Floating Header Overlay

#### Positioning & Style
- **Position**: Floating overlay at top of screen, above card stack
- **Background**: Semi-transparent backdrop blur or subtle gradient
- **Height**: 60px with safe area top inset
- **Z-index**: High enough to stay above cards during swipe animations
- **Responsive**: Maintains position across all screen sizes

#### Left Side: Exit Button
- **Visual**: Simple "X" icon (matching Slack style)  
- **Behavior**: Navigate directly to `/library` page
- **Touch target**: 44x44px minimum with adequate padding
- **Color**: White with subtle shadow/outline for contrast over cards

#### Center: Progress Counter  
- **Format**: "{remaining} Left" (e.g., "2 Left")
- **Dynamic**: Updates immediately after each swipe action
- **Typography**: Medium weight, 16-18px font, centered
- **Color**: White with subtle shadow for visibility over any card content

#### Right Side: Undo Button
- **Visual**: "Undo" text button (matching Slack style)
- **Behavior**: Reverse last review action, step by step
- **State**: Disabled/faded when no actions to undo
- **Touch target**: 44x44px minimum, right-aligned with padding

### 3. Card Stack System

#### Card Stack Architecture
- **Primary Card**: Top card, fully interactive and swipeable
- **Background Cards**: 2-3 cards visible underneath with stacking effect
- **Depth Simulation**: Progressive scaling, rotation, and shadow to create depth
- **Smooth Transitions**: Cards move up from stack when primary card is swiped away

#### Individual Card Structure
- **Card Shape**: Rounded rectangle with soft shadows (similar to Slack's cards)
- **Responsive Sizing**: 
  - Mobile: 90% screen width, auto height based on content
  - Tablet: Max 600px width, centered
- **Padding**: 20px on mobile, 24px on tablet
- **Background**: White with subtle border or shadow

#### Primary Card Content
- **Reference Header**: Verse reference at top (John 3:16)
  - Typography: 18-20px, bold, serif font (Crimson Text)
  - Color: Primary text color
  - Position: Top of card, centered
  - Spacing: 16px bottom margin

- **Text Content Area**: 
  - Initial State: Blurred content matching text structure
  - Interaction: Full card area tappable for text revelation
  - Typography: 16-18px, regular weight, serif font, 1.5 line height
  - Scroll: Vertical scroll within card if needed for long verses

### 4. Progressive Text Revelation System

#### Mode 1: Full Text (`reference_display_mode: 'full'`)
- **Initial State**: Complete verse text with blur overlay
- **Interaction**: Single tap anywhere reveals full text instantly
- **Visual**: Smooth blur-to-clear transition (300ms)
- **State**: Binary (hidden/revealed)

#### Mode 2: First Letter (`reference_display_mode: 'first'`)  
- **Initial State**: First letter of each word visible, rest blurred
- **Implementation**: Reuse existing first-letter logic from ReviewCard component
- **Interaction**: Single tap reveals complete text
- **Visual**: Partial content visible from start, smooth completion transition

#### Mode 3: Progressive Words (`reference_display_mode: 'blank'`)
- **Initial State**: All words represented as blurred blocks/skeleton shapes
- **Interaction**: Each tap reveals the next unrevealed word in sequence
- **Progress Tracking**: Track current word index, highlight next word to be revealed
- **Visual Feedback**: Subtle animation highlighting the word that will be revealed next
- **Word Boundaries**: Respect punctuation and maintain natural reading flow

#### Blur Implementation
- **Not Loading Skeleton**: Different visual treatment than loading states
- **CSS Filter Blur**: Use `backdrop-filter: blur()` or `filter: blur()` 
- **Overlay Technique**: Semi-transparent overlay with text-shaped cutouts
- **Performance**: Hardware-accelerated transitions where possible

### 5. Gesture System Redesign

#### Current Swipe Behavior (Keep)
- **Horizontal swipes**: Left (incorrect) / Right (correct)
- **Velocity sensitivity**: Fast swipes commit regardless of distance
- **Visual feedback**: Color overlays, progress rings, commit animations
- **Haptic feedback**: Vibration on commit and completion

#### Future-Ready Architecture
```typescript
interface SwipeGestureHandler {
  onSwipeStart: () => void;
  onSwipeProgress: (direction: 'left' | 'right', progress: number) => void;
  onSwipeCommit: (direction: 'left' | 'right') => void;
  onSwipeCancel: () => void;
}

interface SwipeConfig {
  threshold: number;
  velocityThreshold: number;
  enabledDirections: ('left' | 'right' | 'up' | 'down')[];
  // Future: custom actions per direction
  actions?: {
    left?: () => void;
    right?: () => void;
    up?: () => void;
    down?: () => void;
  };
}
```

#### Abstraction Points
- **Gesture detection**: Isolated gesture recognition logic
- **Visual feedback**: Separate component for swipe overlays and animations
- **Action mapping**: Configurable mapping between gestures and review actions
- **State management**: Clear separation between gesture state and review state

### 6. Undo System Architecture

#### Local Session State
```typescript
interface ReviewAction {
  id: string;
  cardId: string;
  wasSuccessful: boolean;
  timestamp: number;
  wordRevealProgress?: number; // For progressive mode
}

interface ReviewSession {
  cards: LibraryVerseCard[];
  actions: ReviewAction[];
  currentCardIndex: number;
  startTime: number;
}
```

#### Undo Logic
1. **Action Stack**: Maintain ordered list of all review actions in current session
2. **State Reversal**: Pop last action and restore previous card/word state
3. **Progress Counter**: Decrement "X Left" counter appropriately  
4. **Card Navigation**: Move back to previous card if needed
5. **Word State**: Restore partial word reveal state for progressive mode

#### Data Persistence Strategy
- **Local Only**: All review actions stored locally until session completion
- **Batch Sync**: Single bulk save of all review logs when user exits session
- **Error Handling**: If batch sync fails, retry with exponential backoff
- **Conflict Resolution**: Maintain local state as source of truth during session

### 7. Floating Bottom Action Buttons

#### Positioning & Layout
- **Position**: Floating overlay at bottom of screen, above card stack
- **Background**: Semi-transparent backdrop blur or subtle gradient (matching header)
- **Height**: 80px with safe area bottom inset
- **Z-index**: High enough to stay above cards during swipe animations
- **Two-button design**: Following Slack pattern exactly

#### Button Specifications
- **Layout**: Side-by-side, equal width with center gap
- **Responsive Sizing**:
  - Mobile: Each button ~45% screen width, 50px height
  - Tablet: Max 280px each, centered
- **Left button**: "Mark Incorrect" (Keep Unread equivalent)
  - Style: Outline/light style with red accent border
  - Background: White/transparent with red border
  - Text: Red color, 16px medium weight
- **Right button**: "Mark Correct" (Mark as Read equivalent)  
  - Style: Solid/filled style with green accent
  - Background: Green solid
  - Text: White color, 16px medium weight
- **Spacing**: 16px gap between buttons, 20px side margins
- **Touch targets**: Full button area 44x50px minimum

#### Interaction Behavior  
- **Tap behavior**: Same as swipe gestures (alternative input method)
- **Visual feedback**: Press states with slight scale/opacity change
- **Immediate response**: Instant feedback before card transition animation
- **Haptic feedback**: Light tap vibration on press
- **Accessibility**: Proper ARIA labels and screen reader announcements

### 8. Mobile-First Design System

#### Responsive Breakpoints  
- **Small mobile**: 320px - 480px (primary target)
- **Large mobile**: 480px - 768px  
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px+ (limited use case)

#### Card Stack Visual System
- **Card shadows**: Progressive depth creating realistic stacking
  - Primary card: `box-shadow: 0 8px 25px rgba(0,0,0,0.15)`
  - Second card: `box-shadow: 0 4px 15px rgba(0,0,0,0.1)` 
  - Third card: `box-shadow: 0 2px 8px rgba(0,0,0,0.05)`
- **Card scaling**: Each background card at 95% scale of the one above
- **Card positioning**: 8px vertical offset between stacked cards for depth
- **Border radius**: 16px mobile, 20px tablet (matching modern iOS/Android)
- **Card backgrounds**: Pure white (#ffffff) with subtle border (#f1f5f9)

#### Responsive Typography
- **Verse references**: 18px mobile → 20px tablet, bold, Crimson Text serif
- **Verse text**: 16px mobile → 18px tablet, regular, Crimson Text serif, 1.5 line height
- **Button text**: 16px across all sizes, medium weight, system font
- **Header elements**: 16px mobile → 18px tablet, medium weight
- **Text shadows**: `0 1px 2px rgba(0,0,0,0.1)` for overlay text readability

#### Mobile-Optimized Spacing
- **Card margins**: 16px mobile, 20px tablet, 24px desktop
- **Card internal padding**: 20px mobile, 24px tablet, 28px desktop
- **Safe area handling**: 
  - Top: `env(safe-area-inset-top) + 16px` 
  - Bottom: `env(safe-area-inset-bottom) + 16px`
- **Touch targets**: 44x44px minimum across all screen sizes
- **Inter-element spacing**: 16px base unit, scaling proportionally

#### Performance-First Animations
- **Card swipe exits**: 400ms ease-out, hardware-accelerated transforms
- **Stack advancement**: 300ms ease-out with staggered timing
- **Text reveal**: 250ms ease-in-out blur/opacity transitions  
- **Button feedback**: 100ms ease-out scale transforms
- **Counter updates**: 200ms ease-in-out opacity changes
- **GPU optimization**: `will-change: transform` on animated elements

### 9. Clean Slate Implementation Strategy

#### Why Complete Rewrite
- **Current complexity**: ReviewCard.tsx is 418 lines with overly complex Framer Motion animations
- **Architecture mismatch**: Existing session management incompatible with local-only + undo requirements  
- **Legacy constraints**: Refactoring would be more complex than clean rebuild
- **Gesture library research**: Need to evaluate best swipe library options beyond Framer Motion

#### Files to Delete & Rebuild
```
src/pages/Review/
├── Review.tsx                 → Complete rewrite
├── hooks/useReview.ts        → Complete rewrite (rename to useSlackReview.ts)
├── components/ReviewCard.tsx → Complete rewrite
└── ...                       → Keep any utility files
```

#### Files to Backup Before Deletion
```
src/pages/Review/
├── Review.tsx.backup         → Preserve current implementation
├── hooks/useReview.ts.backup → Preserve database interaction patterns
└── components/ReviewCard.tsx.backup → Preserve working swipe logic reference
```

#### Database Interactions to Preserve
Extract and document these patterns from current `useReview.ts`:
- `loadDueCards()` with `filterDueCards()` logic
- `loadTodaysCards()` for session types
- `localDb.reviewLogs.create()` for review recording
- `dataService.recordReview()` for remote sync
- `localDb.userProfiles.findByUserId()` for display mode settings
- Session state management patterns
- Error handling approaches

#### Gesture Library Research & Selection

##### Current State: Framer Motion
- **Pros**: Full animation suite, smooth gestures, good documentation
- **Cons**: Heavy bundle size (90kb+), overkill for simple swipes, complex API
- **Current usage**: Only used for swipe gestures in ReviewCard

##### Research Requirements
**Evaluate these alternatives:**
1. **React Spring Gesture** - Lightweight, physics-based animations
2. **@use-gesture/react** - Dedicated gesture library, smaller footprint
3. **Hammer.js** - Mature touch gesture library
4. **Custom CSS/JS** - Minimal implementation for simple left/right swipes
5. **React DnD Touch** - Drag and drop with touch support
6. **React Swipeable** - Simple swipe detection library

**Evaluation Criteria:**
- Bundle size impact on mobile performance
- Touch responsiveness and gesture accuracy  
- API simplicity for future modifications
- Mobile browser compatibility
- Animation performance (60fps requirement)
- TypeScript support quality
- Documentation and community support
- Maintenance and long-term viability

**Decision Matrix Template:**
| Library | Bundle Size | Performance | API Simplicity | Mobile Support | Score |
|---------|-------------|-------------|----------------|----------------|-------|
| Framer Motion | 90kb | 9/10 | 6/10 | 9/10 | ? |
| React Spring | 25kb | 9/10 | 7/10 | 8/10 | ? |
| @use-gesture | 15kb | 8/10 | 8/10 | 9/10 | ? |
| Custom CSS/JS | <2kb | 7/10 | 9/10 | 8/10 | ? |

#### Package Management Changes
```bash
# Remove current gesture library
npm uninstall framer-motion

# Install selected gesture library (TBD after research)
npm install [selected-library]
```

### 10. Technical Implementation Plan

#### Phase 0: Preparation & Research (Week 1)
1. **Backup current files**: Rename with .backup extensions
2. **Document database patterns**: Extract all DB interaction code
3. **Gesture library research**: Complete evaluation matrix and selection
4. **Remove Framer Motion**: Clean package.json and unused imports
5. **Install selected gesture library**: Set up new swipe system foundation

#### Phase 1: Core Architecture (Week 1-2)
1. **Remove Layout wrapper**: Update router for full-screen Review
2. **Create useSlackReview hook**: Local-only session management with undo
3. **Build card stack foundation**: Basic layered card system without gestures
4. **Implement floating overlays**: Header and button overlay positioning

#### Phase 2: Text Revelation System
1. **Blur overlay component**: Reusable blur treatment for text content
2. **Progressive word reveal**: Word-by-word unveiling logic and UI
3. **Mode switching**: Integration with existing user preference system
4. **Smooth transitions**: CSS animations for blur/reveal effects

#### Phase 3: Undo Architecture  
1. **Local session state**: Redesign review hook to store actions locally
2. **Undo logic**: Implement step-by-step action reversal
3. **Batch sync**: Delay cloud sync until session completion
4. **Error handling**: Robust retry logic for failed syncs

#### Phase 4: Gesture System Refactor
1. **Extract gesture logic**: Create reusable swipe gesture hook
2. **Config-driven actions**: Make gesture responses configurable
3. **Visual feedback abstraction**: Separate swipe overlays from card component
4. **Performance optimization**: Smooth 60fps animations on all devices

### 9. Edge Cases & Error Handling

#### Network Connectivity
- **Offline mode**: Full functionality without network connection
- **Sync failures**: Graceful degradation, retry with user notification
- **Partial syncs**: Handle scenarios where some review logs fail to sync

#### Session Interruption
- **App backgrounding**: Preserve session state across app lifecycle
- **Device rotation**: Maintain session state across orientation changes  
- **Memory pressure**: Persist critical session data to prevent loss

#### User Input Edge Cases
- **Rapid interactions**: Debounce/throttle to prevent double-taps
- **Gesture conflicts**: Proper precedence between swipes and taps
- **Accessibility**: Keyboard navigation and screen reader support

#### Data Consistency
- **Undo limits**: Define maximum undo stack size for memory management
- **Concurrent sessions**: Handle multiple tabs/devices gracefully
- **Clock skew**: Robust timestamp handling for review logs

### 10. Visual Design Specifications

#### Color Palette
- **Correct actions**: Green (#22c55e) with proper contrast ratios
- **Incorrect actions**: Red (#ef4444) with proper contrast ratios  
- **Neutral elements**: Primary color scheme from existing design system
- **Overlay effects**: Semi-transparent backgrounds matching Slack style

#### Typography Hierarchy
- **Verse reference**: 24-28px, bold, Crimson Text serif
- **Verse text**: 18-22px, regular, Crimson Text serif, 1.6 line height
- **UI elements**: 14-16px, medium weight, system font
- **Counters**: 16-18px, medium weight, system font

#### Spacing & Layout
- **Header height**: 60px fixed
- **Bottom buttons**: 80px fixed height
- **Content padding**: 20px horizontal, responsive vertical
- **Button padding**: 16px vertical, 24px horizontal
- **Touch targets**: Minimum 44x44px throughout

#### Animation Specifications
- **Card transitions**: 400ms ease-out for swipe exits
- **Text reveal**: 300ms ease-in-out for blur removal
- **Button feedback**: 150ms ease-out for press states  
- **Progress updates**: 200ms ease-in-out for counter changes

### 11. Accessibility Requirements

#### Screen Reader Support
- **Semantic markup**: Proper ARIA labels and roles throughout
- **Content announcements**: Dynamic content changes announced clearly
- **Progress updates**: Card progress and undo actions announced
- **Focus management**: Logical tab order and focus indicators

#### Motor Accessibility
- **Large touch targets**: 44x44px minimum for all interactive elements
- **Gesture alternatives**: Button alternatives for all swipe actions
- **Reduced motion**: Respect `prefers-reduced-motion` system setting
- **One-handed use**: All controls reachable with thumb on large devices

#### Visual Accessibility
- **High contrast**: WCAG AA contrast ratios for all text and UI elements
- **Focus indicators**: Clear focus rings for keyboard navigation
- **Text sizing**: Support for user font size preferences
- **Color independence**: No color-only information conveyance

## Success Criteria & Testing

### Functional Testing
- [ ] Full-screen experience with no UI chrome
- [ ] All 3 text revelation modes working correctly
- [ ] Undo functionality for complete session reversal  
- [ ] Batch sync of review logs on session completion
- [ ] Swipe gestures working smoothly on all supported devices
- [ ] Button alternatives for all gesture actions

### Performance Testing  
- [ ] 60fps animations on mid-range devices
- [ ] Smooth scrolling for long verses
- [ ] Fast app resume from background
- [ ] Memory usage within reasonable bounds during long sessions

### Compatibility Testing
- [ ] iOS Safari (primary target)
- [ ] Android Chrome (secondary)
- [ ] Various screen sizes and orientations
- [ ] Different verse lengths and content types

### Accessibility Testing
- [ ] VoiceOver/TalkBack navigation
- [ ] Keyboard-only navigation
- [ ] High contrast mode support
- [ ] Various font size settings

## Migration & Rollout Plan

### Development Phases
1. **Week 1**: Layout restructuring and header/footer implementation
2. **Week 2**: Text revelation system and blur mechanics  
3. **Week 3**: Undo architecture and local state management
4. **Week 4**: Gesture system refactoring and visual polish
5. **Week 5**: Testing, accessibility, and performance optimization

### Feature Flags
- **Enable new review interface**: Gradual rollout to user segments
- **Progressive revelation modes**: A/B testing of different revelation strategies
- **Gesture sensitivity**: Tunable parameters for swipe thresholds

### Rollback Plan
- **Component isolation**: New review page as separate component tree
- **Database compatibility**: No breaking changes to review log schema
- **User preference preservation**: All existing settings remain functional
- **Quick revert**: Feature flag to instantly return to current implementation

---

This PRD provides a comprehensive blueprint for transforming the Verses review experience into a Slack-inspired, immersive Bible study tool that maintains the robust spaced repetition functionality while dramatically improving user experience and engagement.
