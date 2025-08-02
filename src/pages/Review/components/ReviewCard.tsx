/**
 * ReviewCard Component
 * 
 * Interactive card for reviewing and practicing Bible verses.
 * Shows reference, allows toggling text visibility, and captures review results.
 */

import React, { useState } from 'react';
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
}

export function ReviewCard({ verseCard, onCorrect, onIncorrect, showProgress, progress }: ReviewCardProps) {
  const [showingText, setShowingText] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  const { verse, currentPhase, currentStreak } = verseCard;

  const handleToggleText = () => {
    setShowingText(!showingText);
  };

  const handleCorrect = () => {
    setHasAnswered(true);
    onCorrect();
  };

  const handleIncorrect = () => {
    setHasAnswered(true);
    onIncorrect();
  };

  const phaseColors = {
    daily: 'bg-success/10 text-success',
    weekly: 'bg-primary/10 text-primary',
    biweekly: 'bg-accent/10 text-accent',
    monthly: 'bg-error/10 text-error'
  };

  const phaseLabels = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly'
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress indicator */}
      {showProgress && progress && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-primary/70 mb-3">
            <span>Card {progress.current} of {progress.total}</span>
            <span className="flex items-center gap-2">
              {currentStreak > 0 && (
                <>
                  <span className="text-accent">🔥</span>
                  <span className="font-medium text-primary">{currentStreak} streak</span>
                </>
              )}
            </span>
          </div>
          <div className="w-full bg-primary/10 rounded-full h-2">
            <div 
              className="bg-accent h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-background rounded-xl shadow-lg border border-primary/10 p-8 min-h-[500px] flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="font-crimson text-3xl font-semibold text-primary mb-4">
            {verse.reference}
          </h2>
          
          {/* Tally marks below reference */}
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-8 rounded-sm ${
                  i < currentStreak ? 'bg-accent' : 'bg-primary/20'
                }`}
              />
            ))}
          </div>
          
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${phaseColors[currentPhase]}`}>
            {phaseLabels[currentPhase]} Phase
          </span>
        </div>

        {/* Verse content area */}
        <div className="flex-1 flex flex-col justify-center mb-8">
          {!showingText ? (
            <div className="text-center">
              <div className="text-6xl mb-6">📖</div>
              <p className="text-primary/70 text-lg mb-8 max-w-md mx-auto leading-relaxed">
                Try to recite this verse from memory, then reveal to check your answer.
              </p>
              <button
                onClick={handleToggleText}
                className="w-full px-6 py-4 bg-accent text-white rounded-lg font-medium text-lg hover:bg-accent/90 transition-colors"
                disabled={hasAnswered}
              >
                Show Verse
              </button>
            </div>
          ) : (
            <div className="text-center px-4">
              <blockquote className="font-crimson text-xl leading-relaxed text-primary mb-6 max-w-lg mx-auto">
                "{verse.text}"
              </blockquote>
              <cite className="font-crimson text-primary/70 font-medium">
                {verse.reference} ({verse.translation})
              </cite>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {showingText && !hasAnswered && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleIncorrect}
              className="w-full sm:w-auto px-8 py-4 bg-error text-white rounded-lg font-medium text-lg hover:bg-error/90 transition-colors flex items-center justify-center gap-2"
            >
              <span>❌</span>
              Needs Work
            </button>
            <button
              onClick={handleCorrect}
              className="w-full sm:w-auto px-8 py-4 bg-success text-white rounded-lg font-medium text-lg hover:bg-success/90 transition-colors flex items-center justify-center gap-2"
            >
              <span>✅</span>
              Correct
            </button>
          </div>
        )}

        {/* Post-answer state */}
        {hasAnswered && (
          <div className="text-center">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-primary/70">
              Moving to next card...
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!showingText && !hasAnswered && (
        <div className="mt-6 text-center text-sm text-primary/50">
          <p>💡 Try to recite the verse from memory before revealing</p>
        </div>
      )}
    </div>
  );
}