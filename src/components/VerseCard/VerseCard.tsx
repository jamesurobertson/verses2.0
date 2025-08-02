/**
 * VerseCard Component
 * 
 * A swipeable card for Bible verse memorization with:
 * - Reference display modes (full, first, blank)
 * - Text/reference toggle on tap
 * - Swipe gestures for correct/incorrect answers
 * - Mobile-first responsive design
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { VerseCardProps, ReferenceDisplayMode } from '../../types/verse';
import './VerseCard.css';

/**
 * Formats reference based on display mode
 */
function formatReference(reference: string, mode: ReferenceDisplayMode): string {
  switch (mode) {
    case 'full':
      return reference;
    case 'first':
      // Show only book and chapter (e.g., "John 3:16" -> "John 3")
      const match = reference.match(/^(.+?)\s+(\d+)/);
      return match ? `${match[1]} ${match[2]}` : reference;
    case 'blank':
      return '???';
    default:
      return reference;
  }
}

/**
 * Formats phase name for display
 */
function formatPhase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

export const VerseCard: React.FC<VerseCardProps> = ({
  verseCard,
  referenceDisplayMode,
  showingText,
  onCorrect,
  onIncorrect,
  onToggleView,
}) => {
  const { verse, currentPhase, currentStreak } = verseCard;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: any) => {
    const threshold = 100; // Minimum swipe distance
    const { offset } = info;

    if (Math.abs(offset.x) > threshold) {
      if (offset.x > 0) {
        // Swiped right - correct answer
        onCorrect(verseCard.id);
      } else {
        // Swiped left - incorrect answer
        onIncorrect(verseCard.id);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleView();
    }
  };

  const displayText = showingText ? verse.text : formatReference(verse.reference, referenceDisplayMode);
  const ariaLabel = `Verse card for ${verse.reference}. ${showingText ? 'Showing text' : 'Showing reference'}. Tap to toggle, swipe right for correct, swipe left for incorrect.`;

  return (
    <motion.div
      className="verse-card"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 0.95 }}
      whileDrag={{ rotate: 5, scale: 1.1 }}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ duration: 0.3 }}
    >
      <button
        className="verse-card__content"
        onClick={onToggleView}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        type="button"
      >
        {/* Main content area */}
        <div className="verse-card__main">
          <div className="verse-card__text">
            {displayText}
          </div>
        </div>

        {/* Metadata footer */}
        <div className="verse-card__footer">
          <div className="verse-card__stats">
            <span className="verse-card__streak">🔥 {currentStreak}</span>
            <span className="verse-card__phase">{formatPhase(currentPhase)}</span>
          </div>
          {showingText && (
            <div className="verse-card__translation">
              {verse.translation}
            </div>
          )}
        </div>

        {/* Swipe hints */}
        <div className="verse-card__hints">
          <div className="verse-card__hint verse-card__hint--left">✗</div>
          <div className="verse-card__hint verse-card__hint--right">✓</div>
        </div>

        {/* Tap instruction */}
        <div className="verse-card__tap-hint">
          Tap to toggle view
        </div>
      </button>
    </motion.div>
  );
};