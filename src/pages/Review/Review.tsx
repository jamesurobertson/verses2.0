/**
 * Review page component - Complete Slack-inspired rewrite.
 * Full-screen interface with local-only sessions, undo functionality, and card stack visuals.
 */

import { useNavigate } from 'react-router-dom';
import { useSlackReview } from './hooks/useSlackReview';
import { SlackCard } from './components/SlackCard';
import { EmptyState } from '../../components/shared/EmptyState';
import { ErrorCard } from '../../components/shared/ErrorCard';
import { Card } from '../../components/shared/Card';

export function Review() {
  const navigate = useNavigate();
  const {
    dueCards,
    todaysCards,
    loading,
    error,
    session,
    currentCard,
    sessionProgress,
    referenceDisplayMode,
    startSession,
    startTodaysSession,
    startIncorrectSession,
    markCardCorrect,
    markCardIncorrect,
    undoLastAction,
    completeSession,
    refreshDueCards
  } = useSlackReview();

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      markCardCorrect();
    } else {
      markCardIncorrect();
    }
  };

  const handleCompleteSession = async () => {
    await completeSession();
    navigate('/library');
  };

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-4" style={{ height: '100dvh' }}>
        <ErrorCard 
          title="Failed to load review session"
          message={error}
          onRetry={refreshDueCards}
        />
      </div>
    );
  }

  // Loading state  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-4" style={{ height: '100dvh' }}>
        <Card title="Loading Review">
          <div className="animate-pulse">
            <div className="h-6 bg-primary/10 rounded mb-4"></div>
            <div className="h-4 bg-primary/10 rounded w-2/3"></div>
          </div>
        </Card>
      </div>
    );
  }

  // No session active - show start options
  if (!session) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-4" style={{ height: '100dvh' }}>
        {dueCards.length === 0 ? (
          <EmptyState 
            title="All caught up!"
            description={todaysCards.length === 0 
              ? "No cards due for review today. Great job!" 
              : `Great work! You reviewed ${todaysCards.length} verse${todaysCards.length !== 1 ? 's' : ''} today.`
            }
            actionText={todaysCards.length > 0 ? `Review Today's Cards (${todaysCards.length})` : "View Library"}
            onAction={todaysCards.length > 0 ? startTodaysSession : () => navigate('/library')}
            icon="🎉"
          />
        ) : (
          <div className="text-center max-w-md">
            <EmptyState 
              title={`${dueCards.length} verses ready`}
              description="Ready to review your verses?"
              actionText="Start Review Session"
              onAction={startSession}
              icon="📖"
            />
            <div className="mt-6 space-y-3">
              {todaysCards.length > 0 && (
                <button
                  onClick={startTodaysSession}
                  className="w-full px-6 py-3 bg-accent/20 text-accent border border-accent/20 rounded-lg font-medium hover:bg-accent/30 transition-colors"
                >
                  Review Today's Cards ({todaysCards.length})
                </button>
              )}
              <button
                onClick={() => navigate('/library')}
                className="w-full px-6 py-3 text-primary/60 hover:text-primary hover:bg-primary/5 transition-colors rounded-lg"
              >
                ← Back to Library
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Session completed
  if (!currentCard && sessionProgress.current > 0) {
    return (
      <div className="fixed inset-0 bg-background" style={{ height: '100dvh' }}>
        {/* Floating Header */}
        <div 
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4"
          style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}
          data-testid="header-overlay"
        >
          <button onClick={() => navigate('/library')}>
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-primary font-medium">Session Complete</span>
          <div className="w-6 h-6" />
        </div>

        {/* Main content */}
        <div className="flex items-center justify-center h-full p-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold text-primary mb-3">Congratulations!</h2>
            <p className="text-lg text-primary/80 mb-2">
              You completed your review session
            </p>
            <p className="text-primary/70 mb-8">
              Score: {sessionProgress.correctCount}/{sessionProgress.total} 
              ({Math.round((sessionProgress.correctCount / sessionProgress.total) * 100)}%)
            </p>

            <div className="space-y-3">
              {sessionProgress.incorrectCount > 0 && (
                <button
                  onClick={startIncorrectSession}
                  className="w-full px-6 py-3 bg-accent text-black rounded-lg font-medium hover:bg-accent/90 transition-colors"
                >
                  Review Incorrect Verses ({sessionProgress.incorrectCount})
                </button>
              )}
              
              <button
                onClick={startSession}
                className="w-full px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-lg font-medium hover:bg-primary/20 transition-colors"
              >
                Review All Again
              </button>
              
              <button
                onClick={handleCompleteSession}
                className="w-full px-6 py-3 bg-success text-black rounded-lg font-medium hover:bg-success/90 transition-colors"
              >
                Complete Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active session with current card
  return (
    <div className="fixed inset-0 bg-background" style={{ height: '100dvh' }}>
      {/* Floating Header Overlay */}
      <div 
        className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4"
        style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}
        data-testid="header-overlay"
      >
        <button 
          onClick={handleCompleteSession}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-primary/10 transition-colors"
        >
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="text-center">
          <span className="text-primary font-medium">
            {sessionProgress.total - sessionProgress.current} Left
          </span>
        </div>
        
        <button
          onClick={undoLastAction}
          disabled={session?.actions.length === 0}
          className={`px-3 py-1 rounded-lg font-medium text-sm transition-colors ${
            session?.actions.length === 0 
              ? 'text-primary/30 cursor-not-allowed' 
              : 'text-primary hover:bg-primary/10'
          }`}
        >
          Undo
        </button>
      </div>

      {/* Card Stack Area */}
      <div className="absolute inset-0 flex items-center justify-center p-4" style={{ paddingTop: '80px', paddingBottom: '140px' }}>
        {currentCard && (
          <div className="w-full max-w-lg h-full max-h-[500px] relative">
            <SlackCard
              key={currentCard.id}
              card={currentCard}
              isTopCard={true}
              stackIndex={0}
              onSwipe={handleSwipe}
              referenceDisplayMode={referenceDisplayMode}
              backgroundCards={session.cards.slice(sessionProgress.current + 1, sessionProgress.current + 3)}
            />
          </div>
        )}
      </div>

      {/* Floating Bottom Buttons */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-50 flex gap-4 p-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        data-testid="footer-overlay"
      >
        <button 
          className="flex-1 py-3 border-2 border-red-500 text-red-500 rounded-lg font-medium hover:bg-red-50 active:bg-red-100 transition-colors min-h-[44px]"
          onClick={() => handleSwipe('left')}
        >
          Mark Incorrect
        </button>
        <button 
          className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 active:bg-green-700 transition-colors min-h-[44px]"
          onClick={() => handleSwipe('right')}
        >
          Mark Correct  
        </button>
      </div>

    </div>
  );
}
