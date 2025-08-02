/**
 * Review page component for spaced repetition learning.
 * This is where users review their verse cards using swipeable interactions.
 */
import { useReview } from '../../hooks/useReview';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { VerseStack } from '../../components/VerseStack/VerseStack';

export function Review() {
  const { state } = useApp();
  const { signOut } = useAuth();
  const { dueCards, sessionActive, startReview, endReview, markCardCorrect, markCardIncorrect } = useReview();

  const handleStartSession = () => {
    const cards = startReview();
    // In a real app, we'd get due cards from the database
    // For now, just start with empty session
    console.log('Starting review session with', cards.length, 'cards');
  };

  const handleSessionComplete = (summary: any) => {
    endReview(summary);
    console.log('Session completed:', summary);
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="text-center flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Daily Review</h1>
          <p className="text-gray-600">
            {dueCards.length === 0 
              ? "No cards due for review today! Great job!" 
              : `${dueCards.length} cards ready for review`
            }
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm text-gray-500 hover:text-gray-700 ml-4"
        >
          Sign Out
        </button>
      </div>

      {!sessionActive && dueCards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h2>
          <p className="text-gray-600 mb-6">Check back tomorrow for more verses to review.</p>
          <button 
            onClick={handleStartSession}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Practice Anyway
          </button>
        </div>
      ) : !sessionActive ? (
        <div className="text-center">
          <button 
            onClick={handleStartSession}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors"
          >
            Start Review Session
          </button>
        </div>
      ) : (
        <VerseStack
          cards={dueCards}
          referenceDisplayMode={state.settings.referenceDisplayMode}
          onCardCorrect={markCardCorrect}
          onCardIncorrect={markCardIncorrect}
          onSessionComplete={handleSessionComplete}
        />
      )}
    </div>
  );
}