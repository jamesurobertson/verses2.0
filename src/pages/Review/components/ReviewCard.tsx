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
    daily: 'bg-green-100 text-green-800',
    weekly: 'bg-blue-100 text-blue-800',
    biweekly: 'bg-yellow-100 text-yellow-800',
    monthly: 'bg-purple-100 text-purple-800'
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
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Card {progress.current} of {progress.total}</span>
            <span className="flex items-center gap-2">
              {currentStreak > 0 && (
                <>
                  <span className="text-orange-600">🔥</span>
                  <span className="font-medium">{currentStreak} streak</span>
                </>
              )}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-8 min-h-[400px] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {verse.reference}
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${phaseColors[currentPhase]}`}>
              {phaseLabels[currentPhase]} Phase
            </span>
          </div>
        </div>

        {/* Verse content area */}
        <div className="flex-1 flex flex-col justify-center mb-8">
          {!showingText ? (
            <div className="text-center">
              <div className="text-6xl mb-4">📖</div>
              <p className="text-gray-600 text-lg mb-6">
                Try to recite this verse from memory, then reveal to check your answer.
              </p>
              <button
                onClick={handleToggleText}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors"
                disabled={hasAnswered}
              >
                Reveal Verse
              </button>
            </div>
          ) : (
            <div className="text-center">
              <blockquote className="text-xl leading-relaxed text-gray-800 mb-4 font-serif">
                "{verse.text}"
              </blockquote>
              <cite className="text-gray-600 font-medium">
                {verse.reference} ({verse.translation})
              </cite>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {showingText && !hasAnswered && (
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleIncorrect}
              className="px-8 py-3 bg-red-600 text-white rounded-lg font-medium text-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <span>❌</span>
              Need Practice
            </button>
            <button
              onClick={handleCorrect}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium text-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <span>✅</span>
              Got It Right
            </button>
          </div>
        )}

        {/* Post-answer state */}
        {hasAnswered && (
          <div className="text-center">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-gray-600">
              Moving to next card...
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!showingText && !hasAnswered && (
        <div className="mt-4 text-center text-sm text-gray-500">
          <p>💡 Try to recite the verse from memory before revealing</p>
        </div>
      )}
    </div>
  );
}