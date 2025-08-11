/**
 * SlackCard Component
 * 
 * Interactive swipeable card with Slack-style visuals and @use-gesture handling.
 * Features card stacking effects, progressive text revelation, and mobile-optimized gestures.
 */

import { useState, useEffect } from 'react';
// Try the old import style to match working example
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

  // React Spring for smooth animations - function form needed for api.start()
  const [{ x, y, rotate, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    config: {
      tension: 180,
      friction: 20,
      mass: 0.8
    }
  }), []);

  // Track if card has been swiped away and in which direction
  const [exitState, setExitState] = useState<{isGone: boolean, direction: 'left' | 'right' | null}>({
    isGone: false,
    direction: null
  });

  // Simple drag configuration with tap filtering
  const bind = useDrag(({ down, movement: [mx, my], direction: [xDir], velocity: [vx, vy], tap }) => {
    if (!isTopCard || exitState.isGone) return;

    // Ignore tap events - let onClick handle taps
    if (tap) return;

    if (down) {
      // Only start drag animation if movement is significant
      if (Math.abs(mx) > 5 || Math.abs(my) > 5) {
        // Follow finger
        api.start({
          x: mx,
          y: my, 
          rotate: mx / 100,
          scale: 1.05,
          immediate: true
        });
        setIsDragging(true);
      }
    } else {
      setIsDragging(false);
      
      // Check for swipe - match visual threshold
      const trigger = Math.abs(vx) > 0.2 || Math.abs(mx) > 80;
      
      if (trigger) {
        const direction = xDir < 0 ? 'left' : 'right';
        
        // Get current position and set up CSS animation
        const cardElement = document.querySelector('[data-testid="verse-card"]') as HTMLElement;
        if (cardElement) {
          cardElement.style.setProperty('--start-x', `${x.get()}px`);
          cardElement.style.setProperty('--start-y', `${y.get()}px`);
          cardElement.style.setProperty('--start-rotate', `${rotate.get()}deg`);
          cardElement.style.setProperty('--end-x', direction === 'right' ? '120vw' : '-120vw');
          cardElement.style.setProperty('--end-y', `${y.get() + (vy * 50)}px`);
        }
        
        setExitState({ isGone: true, direction });
        
        // Advance after animation
        setTimeout(() => onSwipe(direction), 800);
      } else {
        // Bounce back with jiggle - debug version
        console.log('Bounce back triggered, current x:', x.get());
        api.start({
          x: 0, y: 0, rotate: 0, scale: 1,
          config: { tension: 800, friction: 8, mass: 1 }, // Much more oscillation
          onChange: (result) => console.log('Bounce animation onChange:', result),
          onRest: () => console.log('Bounce animation complete')
        });
      }
    }
  }, {
    filterTaps: true, // Filter out tap events from drag handling
    threshold: 5      // Minimum movement before drag starts
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

  // Background card stack styling - identical to top card styling
  const getBgStackStyle = (bgIndex: number) => {
    const zIndex = 5 - bgIndex; // Just behind top card (top card has z-index 20)

    return {
      // Copy exact styling from getTopCardStyle() but without dragging state
      zIndex,
      boxShadow: '0 10px 20px rgba(0,0,0,0.15)', // Same as non-dragging top card
      willChange: 'transform',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      opacity: 1 // Full opacity - pure white background
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
      {backgroundCards.slice(0, 1).map((bgCard, bgIndex) => (
        <div
          key={`bg-${bgCard.id}`}
          className="absolute inset-0 bg-white rounded-2xl border border-primary/20 overflow-hidden pointer-events-none"
          style={getBgStackStyle(bgIndex)}
        >
          {/* Background card header - same as top card */}
          <div className="p-4 border-b border-primary/10 flex-shrink-0 z-10">
            <h2 className="text-xl font-bold text-primary text-center">
              {bgCard.verse.reference}
            </h2>
          </div>

          {/* Background card body - same blurred text as top card */}
          <div className="flex-1 flex flex-col justify-center p-4 min-h-0 z-10">
            <div className="text-center">
              <div className="max-h-80 overflow-y-auto">
                <p
                  className="text-primary text-2xl leading-relaxed mb-4 select-none"
                  style={{ 
                    fontFamily: 'serif',
                    filter: 'blur(4px)',
                    WebkitFilter: 'blur(4px)'
                  }}
                >
                  "{bgCard.verse.text}"
                </p>
                <cite className="text-primary/70 text-lg font-medium" style={{ filter: 'blur(2px)' }}>
                  — {bgCard.verse.reference}
                </cite>
                <p className="text-primary/50 text-sm mt-4">
                  Tap to reveal verse clearly
                </p>
              </div>
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
          ${exitState.isGone ? 'animate-swipe-exit' : ''}
        `}
        style={{
          touchAction: 'none', // Fix @use-gesture warning
          ...(isTopCard ? {
            ...getTopCardStyle(),
            x,
            y,
            rotate: rotate.to(r => `${r}deg`),
            scale
          } : getStackStyle())
        }}
        data-testid="verse-card"
      >
        {/* Swipe Overlays - Show during drag and exit animation */}
        {isTopCard && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
            {/* Green Right Swipe Overlay (Correct) */}
            <animated.div
              className="absolute inset-0 rounded-2xl flex items-center justify-center"
              style={{
                background: x.to(val => {
                  // Show during drag or exit animation for right direction
                  if ((!isDragging && exitState.direction !== 'right') || (isDragging && val <= 0)) return 'transparent';
                  const progress = isDragging ? Math.min(val / 80, 1) : 1; // Match 80px threshold
                  const darkOpacity = 0.8 + (progress * 0.2); // 0.8 to 1.0 (very dark)
                  const lightOpacity = 0.2 + (progress * 0.1); // 0.2 to 0.3 (slightly more opaque)
                  return `linear-gradient(135deg, rgba(34, 197, 94, ${lightOpacity}) 0%, rgba(34, 197, 94, ${darkOpacity * 0.7}) 20%, rgba(34, 197, 94, ${darkOpacity * 0.9}) 50%, rgba(34, 197, 94, ${darkOpacity}) 100%)`;
                }),
                opacity: x.to(val => {
                  if (exitState.direction === 'right') return 0.95; // Full opacity during exit
                  return val > 0 && isDragging ? 0.05 + (Math.min(val / 80, 1) * 0.9) : 0;
                })
              }}
            >
              <animated.div
                className="absolute top-4 left-4 flex flex-col items-start gap-3 text-white font-bold text-4xl"
                style={{
                  opacity: x.to(val => {
                    if (exitState.direction === 'right') return 1; // Full opacity during exit
                    return val >= 80 ? 1 : (val > 10 ? Math.min((val - 10) / 70, 0.9) : 0);
                  }),
                  transform: 'translateX(0px)', // Keep static position relative to card
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
                        const progress = Math.min(Math.max(val, 0) / 80, 1); // Match threshold at 80px
                        return 188.5 * (1 - progress);
                      })}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* White filled circle at threshold with extra padding to cover separator */}
                  <animated.div
                    className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: x.to(val => {
                        if (exitState.direction === 'right') return 'white'; // Show during exit
                        return val >= 80 ? 'white' : 'transparent';
                      }),
                      margin: '-4px', // Extend beyond circle to cover any lines
                      width: '72px',
                      height: '72px'
                    }}
                  >
                    <animated.svg
                      className="w-9 h-9"
                      viewBox="0 0 24 24"
                      style={{
                        fill: x.to(val => {
                          if (exitState.direction === 'right') return '#22c55e'; // Green during exit
                          return val >= 80 ? '#22c55e' : 'white';
                        })
                      }}
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </animated.svg>
                  </animated.div>
                </div>
                <span className="text-3xl font-extrabold text-left">CORRECT</span>
              </animated.div>
            </animated.div>

            {/* Red Left Swipe Overlay (Incorrect) */}
            <animated.div
              className="absolute inset-0 rounded-2xl flex items-center justify-center"
              style={{
                background: x.to(val => {
                  // Show during drag or exit animation for left direction
                  if ((!isDragging && exitState.direction !== 'left') || (isDragging && val >= 0)) return 'transparent';
                  const progress = isDragging ? Math.min(Math.abs(val) / 80, 1) : 1; // Match 80px threshold
                  const darkOpacity = 0.8 + (progress * 0.2); // 0.8 to 1.0 (very dark)
                  const lightOpacity = 0.2 + (progress * 0.1); // 0.2 to 0.3 (slightly more opaque)
                  return `linear-gradient(225deg, rgba(239, 68, 68, ${lightOpacity}) 0%, rgba(239, 68, 68, ${darkOpacity * 0.7}) 20%, rgba(239, 68, 68, ${darkOpacity * 0.9}) 50%, rgba(239, 68, 68, ${darkOpacity}) 100%)`;
                }),
                opacity: x.to(val => {
                  if (exitState.direction === 'left') return 0.95; // Full opacity during exit
                  return val < 0 && isDragging ? 0.05 + (Math.min(Math.abs(val) / 80, 1) * 0.9) : 0;
                })
              }}
            >
              <animated.div
                className="absolute top-4 right-4 flex flex-col items-end gap-3 text-white font-bold text-4xl"
                style={{
                  opacity: x.to(val => {
                    if (exitState.direction === 'left') return 1; // Full opacity during exit
                    return val <= -80 ? 1 : (val < -10 ? Math.min((Math.abs(val) - 10) / 70, 0.9) : 0);
                  }),
                  transform: 'translateX(0px)', // Keep static position relative to card
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
                        const progress = Math.min(Math.abs(Math.min(val, 0)) / 80, 1); // Match threshold at 80px
                        return 188.5 * (1 - progress);
                      })}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* White filled circle at threshold with extra padding to cover separator */}
                  <animated.div
                    className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: x.to(val => {
                        if (exitState.direction === 'left') return 'white'; // Show during exit
                        return val <= -80 ? 'white' : 'transparent';
                      }),
                      margin: '-4px', // Extend beyond circle to cover any lines
                      width: '72px',
                      height: '72px'
                    }}
                  >
                    <animated.svg
                      className="w-9 h-9"
                      viewBox="0 0 24 24"
                      style={{
                        fill: x.to(val => {
                          if (exitState.direction === 'left') return '#ef4444'; // Red during exit
                          return val <= -80 ? '#ef4444' : 'white';
                        })
                      }}
                    >
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </animated.svg>
                  </animated.div>
                </div>
                <span className="text-3xl font-extrabold text-right">INCORRECT</span>
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
            <div className="text-center cursor-pointer" onClick={handleToggleText}>
              <div className="max-h-80 overflow-y-auto">
                <p
                  className="text-primary text-2xl leading-relaxed mb-4 select-none"
                  style={{ 
                    fontFamily: 'serif',
                    filter: 'blur(4px)',
                    WebkitFilter: 'blur(4px)',
                    transition: 'filter 0.3s ease'
                  }}
                >
                  "{verse.text}"
                </p>
                <cite className="text-primary/70 text-lg font-medium" style={{ filter: 'blur(2px)' }}>
                  — {verse.reference}
                </cite>
                <p className="text-primary/50 text-sm mt-4">
                  Tap to reveal verse clearly
                </p>
              </div>
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
