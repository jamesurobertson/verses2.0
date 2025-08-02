/**
 * Review page component for spaced repetition learning.
 * This is where users review their verse cards using the new dual-write architecture.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useReview } from './hooks/useReview';
import { ReviewCard } from './components/ReviewCard';

export function Review() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { 
    dueCards, 
    todaysCards,
    loading, 
    error, 
    sessionActive, 
    currentCard, 
    sessionProgress,
    startReview, 
    startTodaysReview,
    startIncorrectReview,
    markCardCorrect, 
    markCardIncorrect, 
    endReview 
  } = useReview();

  const handleStartSession = () => {
    startReview();
  };

  const handleSessionComplete = () => {
    endReview();
    // Navigate back to library after session
    navigate('/library');
  };

  // Authentication required
  if (!isAuthenticated) {
    return (
      <div className="p-4 max-w-lg mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Review</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-blue-800 font-medium mb-2">Sign in required</h3>
          <p className="text-blue-600">Please sign in to review your verses.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Review</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading review</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Review</h1>
        <div className="bg-gray-100 rounded-lg p-8 animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 mx-auto w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded mx-auto w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Review</h1>
        {!sessionActive && (
          <p className="text-gray-600 text-lg">
            {dueCards.length === 0 
              ? "No cards due for review today! Great job!" 
              : `${dueCards.length} verse${dueCards.length !== 1 ? 's' : ''} ready for review`
            }
          </p>
        )}
      </div>

      {/* No cards due */}
      {!sessionActive && dueCards.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h2>
          <p className="text-gray-600 mb-6">
            {todaysCards.length === 0 
              ? "You haven't reviewed any verses today yet."
              : `Great work! You've reviewed all your due verses. You reviewed ${todaysCards.length} verse${todaysCards.length !== 1 ? 's' : ''} today.`
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {todaysCards.length > 0 && (
              <button 
                onClick={() => startTodaysReview()}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Review Today's Cards ({todaysCards.length})
              </button>
            )}
            <button 
              onClick={() => navigate('/library')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              View Library
            </button>
            <button 
              onClick={() => navigate('/add')}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Add New Verse
            </button>
          </div>
        </div>
      )}

      {/* Start session */}
      {!sessionActive && dueCards.length > 0 && (
        <div className="text-center">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 mb-6">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Ready to review {dueCards.length} verse{dueCards.length !== 1 ? 's' : ''}?
            </h2>
            <p className="text-gray-600 mb-6">
              Try to recite each verse from memory, then check your answer.
            </p>
            <button 
              onClick={handleStartSession}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors"
            >
              Start Review Session
            </button>
          </div>
          
          <button 
            onClick={() => navigate('/library')}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back to Library
          </button>
        </div>
      )}

      {/* Active session */}
      {sessionActive && currentCard && (
        <div>
          <ReviewCard
            verseCard={currentCard}
            onCorrect={markCardCorrect}
            onIncorrect={markCardIncorrect}
            showProgress={true}
            progress={sessionProgress}
          />
          
          {/* Session controls */}
          <div className="text-center mt-6">
            <button 
              onClick={handleSessionComplete}
              className="text-gray-600 hover:text-gray-800 transition-colors text-sm"
            >
              End Session Early
            </button>
          </div>
        </div>
      )}

      {/* Session completed automatically when all cards are done */}
      {sessionActive && !currentCard && sessionProgress.current > sessionProgress.total && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Session Complete!</h2>
          <p className="text-gray-600 mb-6">
            You got {sessionProgress.correctCount} out of {sessionProgress.total} verses correct.
          </p>
          
          {/* Review Again Options */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <button 
              onClick={() => {
                endReview();
                setTimeout(() => startReview(), 100); // Small delay to reset state
              }}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Review All Again
            </button>
            
            {sessionProgress.incorrectCount > 0 && (
              <button 
                onClick={() => {
                  endReview();
                  setTimeout(() => startIncorrectReview(), 100);
                }}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
              >
                Review Incorrect ({sessionProgress.incorrectCount})
              </button>
            )}
            
            <button 
              onClick={handleSessionComplete}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Return to Library
            </button>
          </div>
          
          {/* Progress Summary */}
          <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-green-600 font-medium">✓ Correct:</span>
              <span className="font-semibold">{sessionProgress.correctCount}</span>
            </div>
            {sessionProgress.incorrectCount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-red-600 font-medium">✗ Incorrect:</span>
                <span className="font-semibold">{sessionProgress.incorrectCount}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}