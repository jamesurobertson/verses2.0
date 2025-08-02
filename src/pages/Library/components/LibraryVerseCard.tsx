/**
 * LibraryVerseCard Component
 * 
 * Displays a verse card in the library with reference, text, and progress information.
 * Provides a clean, accessible layout for browsing saved verses.
 */

import React from 'react';
import type { LibraryVerseCard } from '../hooks/useLibrary';
import { getTodayString } from '../../../utils/dateUtils';

interface LibraryVerseCardProps {
  verseCard: LibraryVerseCard;
  onCardClick?: (card: LibraryVerseCard) => void;
}

const phaseLabels = {
  daily: 'Daily',
  weekly: 'Weekly', 
  biweekly: 'Bi-weekly',
  monthly: 'Monthly'
};

const phaseColors = {
  daily: 'bg-green-100 text-green-800',
  weekly: 'bg-blue-100 text-blue-800',
  biweekly: 'bg-yellow-100 text-yellow-800',
  monthly: 'bg-purple-100 text-purple-800'
};

export function LibraryVerseCard({ verseCard, onCardClick }: LibraryVerseCardProps) {
  const { verse, currentPhase, nextDueDate, currentStreak, lastReviewedAt, archived } = verseCard;
  
  // Calculate if the verse is due for review
  const todayString = getTodayString();
  const isDue = nextDueDate <= todayString && !archived;
  
  // Format the next due date
  const formatDate = (dateString: string) => {
    // Parse YYYY-MM-DD as local date, not UTC
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // Format the last reviewed date
  const formatLastReviewed = (dateString: string | null) => {
    if (!dateString) return 'Never reviewed';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateString);
  };

  const handleClick = () => {
    if (onCardClick) {
      onCardClick(verseCard);
    }
  };

  return (
    <div 
      className={`
        bg-white rounded-lg border-2 p-4 cursor-pointer transition-all duration-200 
        hover:shadow-md hover:border-blue-300
        ${isDue ? 'border-green-300 bg-green-50' : 'border-gray-200'}
        ${archived ? 'opacity-50' : ''}
      `}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Verse card for ${verse.reference}`}
    >
      {/* Header with reference and status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {verse.reference}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Phase badge */}
            <span className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${phaseColors[currentPhase]}
            `}>
              {phaseLabels[currentPhase]}
            </span>
            
            {/* Due status */}
            {isDue && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-600 text-white">
                Due Today
              </span>
            )}
            
            {/* Archived status */}
            {archived && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500 text-white">
                Archived
              </span>
            )}
          </div>
        </div>
        
        {/* Streak indicator */}
        {currentStreak > 0 && (
          <div className="flex items-center text-orange-600 ml-4">
            <span className="text-lg">🔥</span>
            <span className="ml-1 font-semibold">{currentStreak}</span>
          </div>
        )}
      </div>

      {/* Verse text */}
      <div className="mb-4">
        <p className="text-gray-700 leading-relaxed line-clamp-3">
          {verse.text}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {verse.translation}
        </p>
      </div>

      {/* Footer with dates and stats */}
      <div className="flex items-center justify-between text-sm text-gray-600 pt-3 border-t border-gray-100">
        <div>
          <span className="font-medium">Next due:</span>{' '}
          <span className={isDue ? 'text-green-600 font-medium' : ''}>
            {formatDate(nextDueDate)}
          </span>
        </div>
        <div>
          <span className="font-medium">Last reviewed:</span>{' '}
          {formatLastReviewed(lastReviewedAt)}
        </div>
      </div>
    </div>
  );
}