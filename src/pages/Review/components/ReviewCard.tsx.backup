/**
 * ReviewCard Component
 * 
 * Interactive swipeable card for reviewing and practicing Bible verses.
 * Shows reference, allows toggling text visibility, and captures review results via swipe gestures.
 * Swipe left for incorrect, swipe right for correct.
 */

import { useState } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import type { LibraryVerseCard } from '../../Library/hooks/useLibrary';
 

interface ReviewCardProps {
  verseCard: LibraryVerseCard;
  onCorrect: () => void;
  onIncorrect: () => void;
  showProgress?: boolean;
  progress?: {
    current: number;
    total: number;
  };
  referenceDisplayMode: string;
  remainingCards?: number;
  upcomingCards?: LibraryVerseCard[];
}

export function ReviewCard({ verseCard, onCorrect, onIncorrect, referenceDisplayMode, remainingCards = 0, upcomingCards = [] }: ReviewCardProps) {
  const [showingText, setShowingText] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCommitted, setDragCommitted] = useState<'left' | 'right' | null>(null);
  
  const { verse } = verseCard;
  
  // Framer Motion animation controls
  const cardControls = useAnimation();
  const x = useMotionValue(0);
  const y = useMotionValue(0); // Allow vertical movement too
  
  // Advanced transforms for Slack-style dragging (tilt up, half the previous angle)
  const rotate = useTransform(x, [-300, 0, 300], [10, 0, -10]);
  const scale = useTransform([x, y] as const, (values) => {
    const [xVal, yVal] = values as [number, number];
    const distance = Math.hypot(xVal, yVal);
    return isDragging ? Math.max(0.9, 1 - distance / 1000) : 1;
  });
  
  // Progressive loading indicators
  const COMMIT_THRESHOLD = 150;
  const VELOCITY_COMMIT = 600;
  const leftProgress = useTransform(x, [0, -COMMIT_THRESHOLD], [0, 1]);
  const rightProgress = useTransform(x, [0, COMMIT_THRESHOLD], [0, 1]);

  // Overlay opacity mappings (appear lightly immediately at 0.05, grow to 0.95)
  const MIN_OVERLAY_OPACITY = 0.05;
  const MAX_OVERLAY_OPACITY = 0.95;
  const rightOverlayBackground = useTransform(rightProgress, (v) => {
    const a = v === 0 ? 0 : MIN_OVERLAY_OPACITY + (MAX_OVERLAY_OPACITY - MIN_OVERLAY_OPACITY) * v;
    const c = v >= 1 ? 1 : a;
    return `radial-gradient(circle at 3rem 3rem, rgba(34, 197, 94, ${c}) 0%, rgba(34, 197, 94, ${a}) 35%, rgba(34, 197, 94, ${a * 0.8}) 70%, rgba(34, 197, 94, ${a}) 100%)`;
  });
  const leftOverlayBackground = useTransform(leftProgress, (v) => {
    const a = v === 0 ? 0 : MIN_OVERLAY_OPACITY + (MAX_OVERLAY_OPACITY - MIN_OVERLAY_OPACITY) * v;
    const c = v >= 1 ? 1 : a;
    return `radial-gradient(circle at right 3rem top 3rem, rgba(239, 68, 68, ${c}) 0%, rgba(239, 68, 68, ${a}) 35%, rgba(239, 68, 68, ${a * 0.8}) 70%, rgba(239, 68, 68, ${a}) 100%)`;
  });

  // Corner badge visibility
  const rightBadgeOpacity = useTransform(rightProgress, [0, 1], [0, 1]);
  const leftBadgeOpacity = useTransform(leftProgress, [0, 1], [0, 1]);

  // Corner icon progress (circular fill and ring)
  const ICON_RADIUS = 22;
  const ICON_CIRCUMFERENCE = 2 * Math.PI * ICON_RADIUS;
  const rightStrokeOffset = useTransform(rightProgress, (v) => ICON_CIRCUMFERENCE * (1 - v));
  const leftStrokeOffset = useTransform(leftProgress, (v) => ICON_CIRCUMFERENCE * (1 - v));
  // Icon interior should only fill when progress >= threshold (commit)
  const rightIconFill = useTransform(rightProgress, (v) => (v >= 1 ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0)'));
  const leftIconFill = useTransform(leftProgress, (v) => (v >= 1 ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0)'));
  const rightCheckColor = useTransform(rightProgress, (v) => (v >= 1 ? 'rgb(34, 197, 94)' : '#ffffff'));
  const leftXColor = useTransform(leftProgress, (v) => (v >= 1 ? 'rgb(239, 68, 68)' : '#ffffff'));

  const handleToggleText = () => {
    setShowingText(!showingText);
  };

  // Vibration feedback helper (mobile-only, respects reduced motion)
  const triggerVibration = (pattern: number | number[]) => {
    try {
      navigator?.vibrate?.(pattern);
    } catch {
      // no-op
    }
  };

  const handlePanStart = () => {
    setIsDragging(true);
    setDragCommitted(null);
    // No initial vibration here per latest spec; only vibrate at commit
  };

  const handlePan = (_event: any, info: PanInfo) => {
    const currentX = info.offset.x;
    const wasCommitted = dragCommitted;
    
    // Check if we've crossed the commit threshold
    if (Math.abs(currentX) >= COMMIT_THRESHOLD) {
      const direction = currentX > 0 ? 'right' : 'left';
      if (!wasCommitted || wasCommitted !== direction) {
        setDragCommitted(direction);
        // Fire a short vibration on commit; additional confirmation happens on release animation
        triggerVibration(100);
      }
    } else if (wasCommitted) {
      setDragCommitted(null);
      // No vibration when uncommitting
    }
  };

  const handlePanEnd = async (_event: any, info: PanInfo) => {
    setIsDragging(false);
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    
    // Decide commit and direction using sign-aware logic
    const committedDirection =
      Math.abs(offset) >= COMMIT_THRESHOLD
        ? (offset > 0 ? 'right' : 'left')
        : Math.abs(velocity) > VELOCITY_COMMIT
        ? (velocity > 0 ? 'right' : 'left')
        : null;

    if (committedDirection) {
      if (committedDirection === 'right') {
        await cardControls.start({
          x: window.innerWidth + 100,
          y: info.offset.y,
          rotate: 30,
          opacity: 0,
          transition: { duration: 0.4, ease: "easeOut" }
        });
        triggerVibration(40);
        onCorrect();
      } else {
        await cardControls.start({
          x: -(window.innerWidth + 100),
          y: info.offset.y,
          rotate: -30,
          opacity: 0,
          transition: { duration: 0.4, ease: "easeOut" }
        });
        triggerVibration(40);
        onIncorrect();
      }
    } else {
      // Not committed - spring back to center
      setDragCommitted(null);
      // Remove any tint by resetting motion values
      x.set(0);
      y.set(0);
      await cardControls.start({
        x: 0,
        y: 0,
        rotate: 0,
        transition: { type: "spring", stiffness: 110, damping: 40, mass: 0.9, bounce: 0.06, restDelta: 0.001 }
      });
    }
  };

  let textDisplay;

  switch (referenceDisplayMode) {
    case 'first':
      textDisplay = verse.text;
      break;
    case 'full':
      textDisplay = verse.text.split(/\s+/)
      .map(word => {
        // Match leading punctuation, core word (letters, apostrophes, hyphens, dashes), trailing punctuation
        // Apostrophes included inside core: ASCII ' and Unicode ’ (U+2019)
        const m = word.match(/^([^A-Za-z\u2019'\-–—]*)([A-Za-z\u2019'\-–—]+)([^A-Za-z\u2019'\-–—]*)$/);
        if (!m) return word; // leave pure punctuation untouched
        const [, leading, core, trailing] = m;
  
        // Split core on hyphen (-), en-dash (–, U+2013), em-dash (—, U+2014)
        const parts = core.split(/([-–—])/);
  
        // For each segment that is letters+apostrophes, take first letter plus any apostrophes inside
        // But only keep the first letter of each segment; apostrophes are part of letters here, so skip them.
        const reducedCore = parts
          .map(part => {
            if (/^[-–—]$/.test(part)) return part; // keep dashes as-is
  
            // If part has apostrophes, just take first letter (skip apostrophes)
            // For example, "Lord’s" → "L"
            const firstLetterMatch = part.match(/[A-Za-z]/);
            return firstLetterMatch ? firstLetterMatch[0] + '\u00A0\u00A0' : part;
          })
          .join('');
  
        return leading + reducedCore + trailing;
      })
      .join(' ');
      break;
    case 'blank':
      textDisplay = verse.text.split(' ').map((word) => {
        return word.replace(/[^a-zA-Z]/g, '_');
      }).join(' ');
      break;
  }

  return (
    <div className="relative h-125 w-full overflow-visible">
      {/* Background cards with actual verse content - Slack-style */}
      {upcomingCards.map((upcomingCard, index) => {
        if (index >= 2) return null; // Only show 2 background cards max
        
        const scale = 0.9 - (index * 0.05);
        const rotation = (index + 1) * 2;
        const yOffset = (index + 1) * 10;
        const blur = (index + 1) * 1;
        
        return (
          <div
            key={upcomingCard.id}
            className="absolute inset-0 bg-white rounded-3xl border-2 border-primary/20 overflow-hidden"
            style={{
              top: `${yOffset}px`,
              left: '6px',
              right: '6px',
              bottom: `${yOffset + 10}px`,
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              boxShadow: `0 ${15 + index * 10}px ${30 + index * 20}px rgba(0,0,0,0.${15 - index * 2})`,
              filter: `blur(${blur}px)`,
              zIndex: 10 - index
            }}
          >
            {/* Preview of upcoming card content */}
            <div className="p-4 border-b border-primary/10">
              <h3 className="text-lg font-bold text-primary/70 text-center">
                {upcomingCard.verse.reference}
              </h3>
            </div>
            <div className="p-4 flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-12 h-12 text-primary/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm text-primary/40">Next verse</p>
              </div>
            </div>
          </div>
        );
      })}
      

      {/* Main swipeable card - Slack-style with unlimited drag */}
      <motion.div
        className="relative h-full w-full bg-white rounded-3xl border-2 border-primary/10 flex flex-col cursor-grab active:cursor-grabbing"
        style={{ 
          x, 
          y,
          rotate,
          scale,
          touchAction: 'none', // Allow all touch gestures during drag
          willChange: 'transform',
          boxShadow: isDragging 
            ? '0 40px 80px rgba(0,0,0,0.35), 0 20px 40px rgba(0,0,0,0.3)' 
            : '0 30px 60px rgba(0,0,0,0.25), 0 15px 30px rgba(0,0,0,0.2)',
          zIndex: isDragging ? 10000 : 20, // Highest z-index when dragging
          background: dragCommitted === 'left' 
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), white)' 
            : dragCommitted === 'right' 
            ? 'linear-gradient(45deg, white, rgba(34, 197, 94, 0.15))' 
            : 'white'
        }}
        tabIndex={0}
        role="group"
        aria-label="Swipe card: left for incorrect, right for correct"
        animate={cardControls}
        drag={true} // Allow drag in any direction
        dragMomentum={false} // Disable momentum for precise control
        dragElastic={0.25}
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        whileDrag={{ 
          transition: { type: "spring", mass: 0.6, stiffness: 260, damping: 30 }
        }}
      >
        {(isDragging || dragCommitted !== null) && (
          <>
            {/* Full-card overlays with progressive opacity */}
            <motion.div
              className="absolute inset-0 rounded-3xl pointer-events-none z-40"
              style={{ background: rightOverlayBackground, willChange: 'opacity' }}
            />
            <motion.div
              className="absolute inset-0 rounded-3xl pointer-events-none z-40"
              style={{ background: leftOverlayBackground, willChange: 'opacity' }}
            />

            {/* Corner badges that become solid at commit */}
            <motion.div
              className="absolute top-2 left-2 z-50 pointer-events-none"
              style={{ opacity: rightBadgeOpacity }}
            >
              <div className="flex flex-col items-start gap-1">
                <svg className="w-14 h-14" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="8" />
                  <motion.circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="8"
                    strokeDasharray={ICON_CIRCUMFERENCE}
                    style={{ strokeDashoffset: rightStrokeOffset }}
                  />
                  <motion.circle
                    cx="28"
                    cy="28"
                    r="22"
                    style={{ fill: rightIconFill }}
                  />
                  <motion.path d="M20 28l6 6 12-12" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: rightCheckColor }} />
                </svg>
                <span className="text-white text-xl sm:text-2xl font-extrabold leading-none">Correct</span>
              </div>
            </motion.div>

            <motion.div
              className="absolute top-2 right-2 z-50 pointer-events-none"
              style={{ opacity: leftBadgeOpacity }}
            >
              <div className="flex flex-col items-end gap-1">
                <svg className="w-14 h-14" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="8" />
                  <motion.circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="8"
                    strokeDasharray={ICON_CIRCUMFERENCE}
                    style={{ strokeDashoffset: leftStrokeOffset }}
                  />
                  <motion.circle
                    cx="28"
                    cy="28"
                    r="22"
                    style={{ fill: leftIconFill }}
                  />
                  <motion.path d="M20 20l16 16M36 20L20 36" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: leftXColor }} />
                </svg>
                <span className="text-white text-xl sm:text-2xl font-extrabold leading-none">Incorrect</span>
              </div>
            </motion.div>
          </>
        )}
        {/* Drag handle affordance */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2">
          <div className="h-1.5 w-12 rounded-full bg-primary/15" />
        </div>
        {/* Header with reference */}
        <div className="p-4 sm:p-6 border-b border-primary/10 flex-shrink-0 relative z-30">
          <h2 className="text-xl sm:text-2xl font-bold text-primary text-center">
            {verse.reference}
          </h2>
        </div>
        {/* Removed old floating indicators in favor of full-card overlays */}


        {/* Main content area - responsive padding */}
        <div className="flex-1 flex flex-col justify-center p-4 sm:p-6 lg:p-8 min-h-0 relative z-30">
          {!showingText ? (
            <div className="text-center">
              <div className="mb-8" onClick={handleToggleText}>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-lg text-primary/70 mb-6">Tap to reveal the verse</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="max-h-96 overflow-y-auto">
                <p className={`text-primary ${referenceDisplayMode === 'full' ? 'text-xl' : 'text-2xl'} leading-relaxed mb-6`} style={{ fontFamily: 'Crimson Text, serif' }}>
                  "{textDisplay}"
                </p>
                <cite className="text-primary/70 text-lg font-medium" style={{ fontFamily: 'Crimson Text, serif' }}>
                  — {verse.reference}
                </cite>
              </div>
            </div>
          )}
        </div>

        {/* Footer with swipe instruction */}
        <div className="p-3 sm:p-4 lg:p-6 border-t border-primary/10 text-center flex-shrink-0 relative z-30">
          <p className="text-xs sm:text-sm text-primary/60 leading-tight">
            {isDragging ? 'Release to review' : 'Swipe left for incorrect, right for correct'}
          </p>
          {remainingCards > 0 && (
            <p className="text-xs text-primary/40 mt-1">
              {remainingCards} more card{remainingCards !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}