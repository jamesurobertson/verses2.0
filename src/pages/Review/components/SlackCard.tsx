/**
 * SlackCard Component
 * 
 * Interactive swipeable card with Slack-style visuals and @use-gesture handling.
 * Features card stacking effects, progressive text revelation, and mobile-optimized gestures.
 */

import { useState, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';
import type { LibraryVerseCard } from '../../Library/hooks/useLibrary';
import { useTextRevelation, type TextRevelationMode } from '../hooks/useTextRevelation';

interface SlackCardProps {
  card: LibraryVerseCard;
  isTopCard: boolean;
  stackIndex: number; // 0 = top, 1 = second, etc.
  onSwipe: (direction: 'left' | 'right') => void;
  referenceDisplayMode: string;
  backgroundCards?: LibraryVerseCard[];
}

export function SlackCard({
  card,
  isTopCard,
  stackIndex,
  onSwipe,
  referenceDisplayMode,
  backgroundCards = []
}: SlackCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showingText, setShowingText] = useState(false);

  const { verse } = card;

  // Cleanup dragging class on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('dragging');
    };
  }, []);

  // Convert referenceDisplayMode to TextRevelationMode
  const textMode: TextRevelationMode =
    referenceDisplayMode === 'full' ? 'first' :
      referenceDisplayMode === 'first' ? 'first' :
        'blank';

  const {
    displayText,
    revealNext,
    isComplete
  } = useTextRevelation(verse.text, textMode);

  // React Spring for smooth animations
  const [{ x, y, rotate, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1
  }));

  // @use-gesture drag configuration - MOBILE-OPTIMIZED DRAGGING
  const bind = useDrag(({
    down,
    movement: [mx, my],
    velocity: [vx, vy],
    direction: [dx],
    first,
    last,
    event
  }) => {
    // Only allow dragging on top card
    if (!isTopCard) return;

    if (first) {
      setIsDragging(true);
    }

    if (down) {
      // BUTTERY SMOOTH: 1:1 movement anywhere on screen with dynamic effects
      const rotationAmount = mx * 0.1; // Subtle rotation based on horizontal movement
      const scaleAmount = Math.max(0.9, 1 - Math.abs(mx) / 800); // Scale down slightly when dragging far

      // Immediate updates for buttery smooth dragging
      api.start({
        x: mx,
        y: my,
        rotate: rotationAmount,
        scale: scaleAmount,
        immediate: true
      });
    } else {
      // On release
      setIsDragging(false);

      // Check if should commit swipe (horizontal threshold only)
      const THRESHOLD = 120; // Reduced for mobile
      const VELOCITY_THRESHOLD = 600; // Reduced for mobile

      if (Math.abs(mx) > THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD) {
        // Swipe to dismiss - animate completely off screen like Tinder
        const direction = mx > 0 ? 'right' : 'left';
        const screenWidth = window.innerWidth;
        const exitX = direction === 'right' ? screenWidth + 400 : -(screenWidth + 400);
        const exitY = my + (vy * 0.2); // Continue momentum in exit direction

        console.log(`Mobile swipe ${direction} detected - mx: ${mx}, vx: ${vx}, animating to x: ${exitX}`);

        api.start({
          x: exitX,
          y: exitY,
          rotate: direction === 'right' ? 30 : -30,
          scale: 0.7,
          config: {
            tension: 180,
            friction: 20,
            mass: 0.8
          }
        });

        // Call onSwipe immediately to advance to next card
        onSwipe(direction);
        return;
      }

      // CUTE AND BUBBLY BOUNCE BACK - with slight overshoot for adorable bump
      api.start({
        x: 0,
        y: 0,
        rotate: 0,
        scale: 1,
        config: {
          tension: 300,    // Medium tension for bouncy return
          friction: 20,    // Lower friction for more bounce/overshoot
          mass: 1.2        // Higher mass for more pronounced bounce
        }
      });
    }
  }, {
    // SIMPLIFIED: Basic drag configuration that works
    filterTaps: true,       // Filter accidental taps
    axis: undefined,        // Allow all directions
    rubberband: false      // No resistance
  });

  // Card stack styling with CSS transforms
  const getStackStyle = () => {
    const scale = 1 - (stackIndex * 0.05);
    const translateY = stackIndex * 8;
    const rotation = stackIndex * 1;
    const zIndex = 10 - stackIndex;

    return {
      transform: `scale(${scale}) translateY(${translateY}px) rotate(${rotation}deg)`,
      zIndex,
      boxShadow: `0 ${8 + stackIndex * 4}px ${15 + stackIndex * 10}px rgba(0,0,0,${0.15 - stackIndex * 0.02})`
    };
  };

  // Dynamic styling for top card using spring values
  const getTopCardStyle = () => ({
    zIndex: isDragging ? 1000 : 20,
    boxShadow: isDragging
      ? '0 20px 40px rgba(0,0,0,0.3)'
      : '0 10px 20px rgba(0,0,0,0.15)',
    willChange: 'transform',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  });


  const handleToggleText = () => {
    if (!showingText) {
      setShowingText(true);
    } else if (!isComplete) {
      revealNext();
    } else {
      setShowingText(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-visible">
      {/* Background Cards */}
      {backgroundCards.slice(0, 2).map((bgCard) => (
        <div
          key={`bg-${bgCard.id}`}
          className="absolute inset-0 bg-white rounded-2xl border border-primary/20 overflow-hidden pointer-events-none"
          style={getStackStyle()}
        >
          {/* Background card preview */}
          <div className="p-4 border-b border-primary/10">
            <h3 className="text-lg font-bold text-primary/70 text-center">
              {bgCard.verse.reference}
            </h3>
          </div>
          <div className="p-4 flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-12 h-12 text-primary/30 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-sm text-primary/40">Coming up</p>
            </div>
          </div>
        </div>
      ))}

      {/* Main Card */}
      <animated.div
        {...(isTopCard ? bind() : {})}
        className={`
          absolute inset-0 bg-white rounded-2xl border border-primary/10 
          flex flex-col overflow-hidden cursor-grab active:cursor-grabbing
          ${isTopCard ? 'swipeable-card' : ''}
        `}
        style={isTopCard ? {
          ...getTopCardStyle(),
          x,
          y,
          rotate: rotate.to(r => `${r}deg`),
          scale
        } : getStackStyle()}
        data-testid="verse-card"
      >
        {/* Swipe Overlays - Best Practice Structure */}
        {isTopCard && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
            {/* Green Right Swipe Overlay (Correct) */}
            <animated.div
              className="absolute inset-0 rounded-2xl flex items-center justify-center"
              style={{
                background: x.to(val => {
                  if (!isDragging || val <= 0) return 'transparent';
                  const progress = Math.min(val / 150, 1);
                  const darkOpacity = 0.4 + (progress * 0.55); // 0.4 to 0.95
                  const lightOpacity = 0.2 + (progress * 0.5); // 0.2 to 0.7
                  return `radial-gradient(ellipse 200% 180% at top left, rgba(34, 197, 94, ${darkOpacity}) 0%, rgba(34, 197, 94, ${darkOpacity * 0.9}) 30%, rgba(34, 197, 94, ${lightOpacity}) 70%, rgba(34, 197, 94, ${lightOpacity * 0.3}) 100%)`;
                }),
                opacity: x.to(val => val > 0 && isDragging ? 0.05 + (Math.min(val / 150, 1) * 0.9) : 0)
              }}
            >
              <animated.div
                className="absolute top-2 left-2 flex flex-col items-center gap-3 text-white font-bold text-2xl"
                style={{
                  opacity: x.to(val => val >= 150 ? 1 : (val > 10 ? Math.min((val - 10) / 80, 0.9) : 0)),
                  transform: x.to(val => `translateX(${Math.min(val * 0.1, 20)}px)`),
                  zIndex: 2000
                }}
              >
                <div className="relative w-16 h-16">
                  {/* Circle with proper border alignment */}
                  <svg className="w-16 h-16 transform -rotate-90 absolute inset-0" viewBox="0 0 64 64">
                    {/* Base circle border */}
                    <circle
                      cx="32"
                      cy="32"
                      r="30"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    {/* Progress circle that fills */}
                    <animated.circle
                      cx="32"
                      cy="32"
                      r="30"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeDasharray="188.5" // 2 * π * 30
                      strokeDashoffset={x.to(val => {
                        const progress = Math.min(Math.max(val, 0) / 150, 1);
                        return 188.5 * (1 - progress);
                      })}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* White filled circle at threshold with extra padding to cover separator */}
                  <animated.div
                    className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: x.to(val => val >= 150 ? 'white' : 'transparent'),
                      margin: '-4px', // Extend beyond circle to cover any lines
                      width: '72px',
                      height: '72px'
                    }}
                  >
                    <animated.svg
                      className="w-9 h-9"
                      viewBox="0 0 24 24"
                      style={{
                        fill: x.to(val => val >= 150 ? '#22c55e' : 'white')
                      }}
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </animated.svg>
                  </animated.div>
                </div>
                <span className="text-xl font-extrabold">CORRECT</span>
              </animated.div>
            </animated.div>

            {/* Red Left Swipe Overlay (Incorrect) */}
            <animated.div
              className="absolute inset-0 rounded-2xl flex items-center justify-center"
              style={{
                background: x.to(val => {
                  if (!isDragging || val >= 0) return 'transparent';
                  const progress = Math.min(Math.abs(val) / 150, 1);
                  const darkOpacity = 0.4 + (progress * 0.55); // 0.4 to 0.95
                  const lightOpacity = 0.2 + (progress * 0.5); // 0.2 to 0.7
                  return `radial-gradient(ellipse 200% 180% at top right, rgba(239, 68, 68, ${darkOpacity}) 0%, rgba(239, 68, 68, ${darkOpacity * 0.9}) 30%, rgba(239, 68, 68, ${lightOpacity}) 70%, rgba(239, 68, 68, ${lightOpacity * 0.3}) 100%)`;
                }),
                opacity: x.to(val => val < 0 && isDragging ? 0.05 + (Math.min(Math.abs(val) / 150, 1) * 0.9) : 0)
              }}
            >
              <animated.div
                className="absolute top-2 right-2 flex flex-col items-center gap-3 text-white font-bold text-2xl"
                style={{
                  opacity: x.to(val => val <= -150 ? 1 : (val < -10 ? Math.min((Math.abs(val) - 10) / 80, 0.9) : 0)),
                  transform: x.to(val => `translateX(${Math.max(val * 0.1, -20)}px)`),
                  zIndex: 2000
                }}
              >
                <div className="relative w-16 h-16">
                  {/* Circle with proper border alignment */}
                  <svg className="w-16 h-16 transform -rotate-90 absolute inset-0" viewBox="0 0 64 64">
                    {/* Base circle border */}
                    <circle
                      cx="32"
                      cy="32"
                      r="30"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    {/* Progress circle that fills */}
                    <animated.circle
                      cx="32"
                      cy="32"
                      r="30"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeDasharray="188.5" // 2 * π * 30
                      strokeDashoffset={x.to(val => {
                        const progress = Math.min(Math.abs(Math.min(val, 0)) / 150, 1);
                        return 188.5 * (1 - progress);
                      })}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* White filled circle at threshold with extra padding to cover separator */}
                  <animated.div
                    className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: x.to(val => val <= -150 ? 'white' : 'transparent'),
                      margin: '-4px', // Extend beyond circle to cover any lines
                      width: '72px',
                      height: '72px'
                    }}
                  >
                    <animated.svg
                      className="w-9 h-9"
                      viewBox="0 0 24 24"
                      style={{
                        fill: x.to(val => val <= -150 ? '#ef4444' : 'white')
                      }}
                    >
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </animated.svg>
                  </animated.div>
                </div>
                <span className="text-xl font-extrabold">INCORRECT</span>
              </animated.div>
            </animated.div>
          </div>
        )}

        {/* Drag handle affordance for top card */}
        {isTopCard && (
          <div className="absolute left-1/2 -translate-x-1/2 top-2 z-50">
            <div className="h-1.5 w-12 rounded-full bg-primary/15" />
          </div>
        )}

        {/* Header with reference */}
        <div className="p-4 border-b border-primary/10 flex-shrink-0 z-10">
          <h2 className="text-xl font-bold text-primary text-center">
            {verse.reference}
          </h2>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col justify-center p-4 min-h-0 z-10">
          {!showingText ? (
            <div className="text-center" onClick={handleToggleText}>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-primary/20 transition-colors">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-lg text-primary/70">Tap to reveal verse</p>
            </div>
          ) : (
            <div className="text-center" onClick={handleToggleText}>
              <div className="max-h-80 overflow-y-auto">
                <p
                  className="text-primary text-2xl leading-relaxed mb-4 cursor-pointer select-none"
                  style={{ fontFamily: 'serif' }}
                >
                  "{displayText}"
                </p>
                <cite className="text-primary/70 text-lg font-medium">
                  — {verse.reference}
                </cite>

                {/* Progressive revelation hints */}
                {textMode === 'blank' && !isComplete && (
                  <p className="text-primary/50 text-sm mt-4">
                    Tap to reveal next word
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </animated.div>

    </div>
  );
}
