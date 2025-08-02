/**
 * VerseStack Component
 * 
 * Manages a stack of verse cards for review sessions with:
 * - Card progression and stack management
 * - Progress tracking
 * - Session completion handling
 * - Empty state display
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VerseCard } from '../VerseCard/VerseCard';
import type { VerseStackProps, SessionSummary } from '../../types/verse';
import './VerseStack.css';

export const VerseStack: React.FC<VerseStackProps> = ({
  cards,
  referenceDisplayMode,
  onCardCorrect,
  onCardIncorrect,
  onSessionComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showingText, setShowingText] = useState(false);

  const handleCardCorrect = useCallback((cardId: string) => {
    onCardCorrect(cardId);
    advanceToNextCard();
  }, [onCardCorrect]);

  const handleCardIncorrect = useCallback((cardId: string) => {
    onCardIncorrect(cardId);
    advanceToNextCard();
  }, [onCardIncorrect]);

  const handleToggleView = useCallback(() => {
    setShowingText(prev => !prev);
  }, []);

  const advanceToNextCard = useCallback(() => {
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= cards.length) {
      // Session complete
      const summary: SessionSummary = {
        totalCards: cards.length,
        correctAnswers: 0, // Not tracking stats
        incorrectAnswers: 0, // Not tracking stats
      };
      
      onSessionComplete(summary);
    } else {
      setCurrentIndex(nextIndex);
      setShowingText(false); // Reset to reference view for next card
    }
  }, [currentIndex, cards.length, onSessionComplete]);

  // Empty state
  if (cards.length === 0) {
    return (
      <div className="verse-stack verse-stack--empty">
        <div className="verse-stack__empty-content">
          <div className="verse-stack__empty-icon">🎉</div>
          <h2 className="verse-stack__empty-title">Great Job!</h2>
          <p className="verse-stack__empty-message">
            No cards to review right now.
            <br />
            Check back tomorrow for more practice!
          </p>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progress = `${currentIndex + 1} of ${cards.length}`;

  return (
    <div className="verse-stack">
      {/* Progress indicator */}
      <div className="verse-stack__progress">
        <div className="verse-stack__progress-text">{progress}</div>
        <div className="verse-stack__progress-bar">
          <div 
            className="verse-stack__progress-fill"
            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card stack */}
      <div className="verse-stack__cards">
        <AnimatePresence mode="wait">
          {/* Current card */}
          <motion.div
            key={`card-${currentIndex}`}
            className="verse-stack__card verse-stack__card--current"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <VerseCard
              verseCard={currentCard}
              referenceDisplayMode={referenceDisplayMode}
              showingText={showingText}
              onCorrect={handleCardCorrect}
              onIncorrect={handleCardIncorrect}
              onToggleView={handleToggleView}
            />
          </motion.div>
        </AnimatePresence>

        {/* Next card preview (if exists) */}
        {currentIndex + 1 < cards.length && (
          <motion.div
            className="verse-stack__card verse-stack__card--next"
            initial={{ scale: 0.95, opacity: 0.5 }}
            animate={{ scale: 0.95, opacity: 0.5 }}
            transition={{ duration: 0.3 }}
          >
            <VerseCard
              verseCard={cards[currentIndex + 1]}
              referenceDisplayMode={referenceDisplayMode}
              showingText={false}
              onCorrect={() => {}} // No-op for preview card
              onIncorrect={() => {}} // No-op for preview card
              onToggleView={() => {}} // No-op for preview card
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};