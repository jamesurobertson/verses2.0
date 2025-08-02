/**
 * Library page component for managing verse collections.
 * Users can view, organize, and manage their saved verses.
 */

import React, { useState } from 'react';
import { useLibrary, type LibraryVerseCard } from './hooks/useLibrary';
import { LibraryVerseCard as VerseCardComponent } from './components/LibraryVerseCard';
import { useAuth } from '../../hooks/useAuth';

export function Library() {
  const { user, isAuthenticated } = useAuth();
  const { verses, loading, error, totalCount, dueCount, refreshLibrary, clearError } = useLibrary();
  const [selectedCard, setSelectedCard] = useState<LibraryVerseCard | null>(null);

  // Handle card click for future expansion (could open detail view, start review, etc.)
  const handleCardClick = (card: LibraryVerseCard) => {
    setSelectedCard(card);
    // TODO: Could navigate to review mode or detail view
    console.log('Card clicked:', card.verse.reference);
  };

  // Error state
  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Library</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-red-800 font-medium">Error loading library</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => {
                clearError();
                refreshLibrary();
              }}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authentication required state
  if (!isAuthenticated) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Library</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h3 className="text-blue-800 font-medium mb-2">Sign in required</h3>
          <p className="text-blue-600">Please sign in to view your verse library.</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Library</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-3 w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (verses.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Library</h1>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📚</div>
          <h3 className="text-gray-800 font-medium mb-2">Your library is empty</h3>
          <p className="text-gray-600 mb-4">
            Start building your verse collection by adding your first verse.
          </p>
          <a
            href="/add"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Verse
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header with stats */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Library</h1>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            <span>{totalCount} verses total</span>
          </div>
          {dueCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <span>{dueCount} due for review</span>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={refreshLibrary}
            disabled={loading}
            className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
          >
            🔄 Refresh
          </button>
          
          {dueCount > 0 && (
            <a
              href="/review"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Review {dueCount} Due Verses
            </a>
          )}
        </div>

        <a
          href="/add"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Add Verse
        </a>
      </div>

      {/* Verse cards grid */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
        {verses.map((verseCard) => (
          <VerseCardComponent
            key={verseCard.id}
            verseCard={verseCard}
            onCardClick={handleCardClick}
          />
        ))}
      </div>

      {/* Debug info (remove in production) */}
      {selectedCard && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">Selected Card (Debug):</h4>
          <pre className="text-xs text-gray-600 overflow-auto">
            {JSON.stringify(selectedCard, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}