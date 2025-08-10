/**
 * Review page component for spaced repetition learning.
 * This is where users review their verse cards using the new dual-write architecture.
 */

import { useNavigate } from 'react-router-dom';
import { useReview } from './hooks/useReview';
import { ReviewCard } from './components/ReviewCard';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Review() {
  const navigate = useNavigate();
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

  // Debug logging for rendering issues
  console.log('Review Component Render:', {
    sessionActive,
    currentCard: currentCard ? currentCard.verse.reference : 'null',
    sessionProgress,
    willShowCard: sessionActive && currentCard,
    willShowCompletion: sessionActive && !currentCard && sessionProgress.current > 0
  });

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
    <div className="bg-background min-h-screen relative">
      {/* Use calc to subtract navbar height (80px) from viewport height */}
      <div style={{ height: 'calc(100vh - 80px)' }} className="flex flex-col overflow-x-visible overflow-y-hidden">
        {/* Header - compact for full-height cards */}
        {!sessionActive && (
          <div className="text-center p-4">
            <h1 className="text-3xl font-bold text-primary mb-2">Daily Review</h1>
            <p className="text-primary/70 text-lg">
              {dueCards.length === 0
                ? "No cards due for review today! Great job!"
                : `${dueCards.length} verse${dueCards.length !== 1 ? 's' : ''} ready for review`
              }
            </p>
          </div>
        )}

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

        {/* Full-page review session - Slack-style using Portal */}
        {sessionActive && currentCard && createPortal(
          <div key={currentCard.id} className="fixed h-full inset-0 bg-background" style={{ zIndex: 10000 }}>
            {/* Header with back arrow */}
            <div className="flex items-center justify-between p-4 border-b border-primary/10">
              <button
                onClick={endReview}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-primary/5 transition-colors"
                aria-label="Go back"
              >
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <p className="text-sm font-medium text-primary">
                  {sessionProgress.current} of {sessionProgress.total}
                </p>
                <p className="text-xs text-primary/60">
                  {sessionProgress.total - sessionProgress.current} left
                </p>
              </div>
              <div className="w-10 h-10" /> {/* Spacer for centering */}
            </div>

            {/* Full-screen card area */}
            <div className="flex-1 relative p-4 overflow-visible flex flex-col">
              <ReviewCard
                verseCard={currentCard}
                onCorrect={markCardCorrect}
                onIncorrect={markCardIncorrect}
                showProgress={true}
                progress={sessionProgress}
                referenceDisplayMode={referenceDisplayMode}
                remainingCards={sessionProgress.total - sessionProgress.current}
                upcomingCards={dueCards.slice(sessionProgress.current, sessionProgress.current + 3)}
              />
            </div>
          </div>,
          document.body
        )}

        {/* Session completed automatically when all cards are done */}
        {sessionActive && !currentCard && sessionProgress.current > 0 && (
          <div className="text-center py-12 px-4">
            <div className="text-8xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold text-primary mb-3">Congratulations!</h2>
            <p className="text-lg text-primary/80 mb-2">
              You've completed your review session
            </p>
            <p className="text-primary/70 mb-8">
              You got {sessionProgress.correctCount} out of {sessionProgress.total} verses correct.
            </p>

            {/* Encouragement Message */}
            <div className="bg-primary/5 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <p className="text-primary/80 text-center">
                {sessionProgress.correctCount === sessionProgress.total
                  ? "Perfect score! 🌟 Your memory work is paying off!"
                  : sessionProgress.correctCount / sessionProgress.total >= 0.8
                    ? "Great work! 💪 You're building strong Scripture memory!"
                    : "Keep going! 📖 Every review strengthens your memory!"
                }
              </p>
            </div>

            {/* Next Steps Options */}
            <div className="space-y-4 max-w-lg mx-auto">
              <h3 className="text-lg font-semibold text-primary mb-4">What would you like to do next?</h3>

              <div className="flex flex-col gap-3">
                {sessionProgress.incorrectCount > 0 && (
                  <button
                    onClick={() => {
                      endReview();
                      setTimeout(() => startIncorrectReview(), 100);
                    }}
                    className="px-6 py-3 bg-accent text-black rounded-lg font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🔄</span>
                    Review Incorrect Verses ({sessionProgress.incorrectCount})
                  </button>
                )}

                <button
                  onClick={() => {
                    endReview();
                    setTimeout(() => startReview(), 100);
                  }}
                  className="px-6 py-3 bg-success text-black rounded-lg font-medium hover:bg-success/90 transition-colors flex items-center justify-center gap-2"
                >
                  <span>🔄</span>
                  Review All Verses Again
                </button>

                <button
                  onClick={() => navigate('/add')}
                  className="px-6 py-3 bg-primary text-black rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <span>➕</span>
                  Add More Verses
                </button>

                <button
                  onClick={handleSessionComplete}
                  className="px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-lg font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
                >
                  <span>📚</span>
                  Return to Library
                </button>
              </div>

              {/* Next Review Info */}
              <div className="mt-8 p-4 bg-background border border-primary/10 rounded-lg">
                <p className="text-sm text-primary/70 text-center">
                  ⏰ Your next review will be available tomorrow based on your spaced repetition schedule
                </p>
              </div>
            </div>

            {/* Progress Summary */}
            <div className="bg-background rounded-lg p-4 max-w-sm mx-auto border border-primary/10 shadow-sm mt-8">
              <h4 className="font-semibold text-primary mb-3 text-center">Session Results</h4>
              <div className="flex justify-between items-center mb-2">
                <span className="text-success font-medium">✓ Correct:</span>
                <span className="font-semibold text-primary">{sessionProgress.correctCount}</span>
              </div>
              {sessionProgress.incorrectCount > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-error font-medium">✗ Incorrect:</span>
                  <span className="font-semibold text-primary">{sessionProgress.incorrectCount}</span>
                </div>
              )}
              <div className="border-t border-primary/10 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-primary">Accuracy:</span>
                  <span className="font-semibold text-primary">
                    {Math.round((sessionProgress.correctCount / sessionProgress.total) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
