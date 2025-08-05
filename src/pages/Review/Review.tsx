/**
 * Review page component for spaced repetition learning.
 * This is where users review their verse cards using the new dual-write architecture.
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../contexts/AuthContext";
import { useReview } from './hooks/useReview';
import { ReviewCard } from './components/ReviewCard';
import { useEffect } from 'react';

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
    endReview,
    referenceDisplayMode
  } = useReview();

  const handleStartSession = () => {
    startReview();
  };

  const handleSessionComplete = () => {
    endReview();
    // Navigate back to library after session
    navigate('/library');
  };

  useEffect(() => {
    startReview();
  }, [startReview]);

  // Authentication required
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Review</h1>
          <div className="bg-background border border-primary/10 rounded-lg p-6 shadow-sm">
            <h3 className="text-primary font-medium mb-2">Sign in required</h3>
            <p className="text-primary/70">Please sign in to review your verses.</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-primary mb-4">Review</h1>
          <div className="bg-background border border-error/20 rounded-lg p-4 shadow-sm">
            <h3 className="text-error font-medium">Error loading review</h3>
            <p className="text-error/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Review</h1>
          <div className="bg-background border border-primary/10 rounded-lg p-8 animate-pulse shadow-sm">
            <div className="h-6 bg-primary/10 rounded mb-4 mx-auto w-2/3"></div>
            <div className="h-4 bg-primary/10 rounded mx-auto w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="p-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Daily Review</h1>
          {!sessionActive && (
            <p className="text-primary/70 text-lg">
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
            <h2 className="text-xl font-semibold text-primary mb-2">All caught up!</h2>
            <p className="text-primary/70 mb-6">
              {todaysCards.length === 0 
                ? "You haven't reviewed any verses today yet."
                : `Great work! You've reviewed all your due verses. You reviewed ${todaysCards.length} verse${todaysCards.length !== 1 ? 's' : ''} today.`
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {todaysCards.length > 0 && (
                <button 
                  onClick={() => startTodaysReview()}
                  className="px-6 py-3 bg-accent text-black rounded-lg font-medium hover:bg-accent/90 transition-colors"
                >
                  Review Today's Cards ({todaysCards.length})
                </button>
              )}
              <button 
                onClick={() => navigate('/library')}
                className="px-6 py-3 bg-primary text-black rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                View Library
              </button>
              <button 
                onClick={() => navigate('/add')}
                className="px-6 py-3 bg-success text-black rounded-lg font-medium hover:bg-success/90 transition-colors"
              >
                Add New Verse
              </button>
            </div>
          </div>
        )}

        {/* Start session */}
        {!sessionActive && dueCards.length > 0 && (
          <div className="text-center">
            <div className="bg-background rounded-lg shadow-sm border border-primary/10 p-8 mb-6">
              <button 
                onClick={handleStartSession}
                className="w-full sm:w-auto px-8 py-4 bg-accent text-black rounded-lg font-medium text-lg hover:bg-accent/90 transition-colors"
              >
                Start Review Session
              </button>
            </div>
            
            <button 
              onClick={() => navigate('/library')}
              className="text-primary/60 hover:text-primary transition-colors"
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
              referenceDisplayMode={referenceDisplayMode}
            />
            
            {/* Session controls */}
            <div className="text-center">
              <button 
                onClick={handleSessionComplete}
                className="text-primary/60 hover:text-primary transition-colors text-sm"
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
            <h2 className="text-xl font-semibold text-primary mb-2">Session Complete!</h2>
            <p className="text-primary/70 mb-6">
              You got {sessionProgress.correctCount} out of {sessionProgress.total} verses correct.
            </p>
            
            {/* Review Again Options */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <button 
                onClick={() => {
                  endReview();
                  setTimeout(() => startReview(), 100); // Small delay to reset state
                }}
                className="px-6 py-3 bg-success text-black rounded-lg font-medium hover:bg-success/90 transition-colors"
              >
                Review All Again
              </button>
              
              {sessionProgress.incorrectCount > 0 && (
                <button 
                  onClick={() => {
                    endReview();
                    setTimeout(() => startIncorrectReview(), 100);
                  }}
                  className="px-6 py-3 bg-accent text-black rounded-lg font-medium hover:bg-accent/90 transition-colors"
                >
                  Review Incorrect ({sessionProgress.incorrectCount})
                </button>
              )}
              
              <button 
                onClick={handleSessionComplete}
                className="px-6 py-3 bg-primary text-black rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Return to Library
              </button>
            </div>
            
            {/* Progress Summary */}
            <div className="bg-background rounded-lg p-4 max-w-md mx-auto border border-primary/10 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-success font-medium">✓ Correct:</span>
                <span className="font-semibold text-primary">{sessionProgress.correctCount}</span>
              </div>
              {sessionProgress.incorrectCount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-error font-medium">✗ Incorrect:</span>
                  <span className="font-semibold text-primary">{sessionProgress.incorrectCount}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}