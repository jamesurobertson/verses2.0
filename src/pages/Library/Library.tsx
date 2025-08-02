/**
 * Library page component for managing verse collections.
 * Users can view, organize, and manage their saved verses.
 */

import { useMemo, useState } from 'react';
import { useLibrary, type LibraryVerseCard } from './hooks/useLibrary';
import { useAuth } from '../../hooks/useAuth';

// Biblical books organized by testament
const OLD_TESTAMENT_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
];

const NEW_TESTAMENT_BOOKS = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

// Function to extract book name from reference
const getBookFromReference = (reference: string): string => {
  // Extract book name before the first number
  const match = reference.match(/^([0-9]?\s*[a-zA-Z\s]+)/);
  return match ? match[1].trim() : 'Unknown';
};

// Function to determine testament
const getTestament = (bookName: string): 'Old Testament' | 'New Testament' => {
  if (OLD_TESTAMENT_BOOKS.includes(bookName)) return 'Old Testament';
  if (NEW_TESTAMENT_BOOKS.includes(bookName)) return 'New Testament';
  return 'New Testament'; // Default
};

// Function to group verses by testament and book
const groupVersesByTestament = (verses: LibraryVerseCard[]) => {
  const grouped = verses.reduce((acc, verse) => {
    const book = getBookFromReference(verse.verse.reference);
    const testament = getTestament(book);
    
    if (!acc[testament]) {
      acc[testament] = {};
    }
    if (!acc[testament][book]) {
      acc[testament][book] = [];
    }
    acc[testament][book].push(verse);
    return acc;
  }, {} as Record<string, Record<string, LibraryVerseCard[]>>);

  // Sort books within each testament by biblical order
  Object.keys(grouped).forEach(testament => {
    const bookOrder = testament === 'Old Testament' ? OLD_TESTAMENT_BOOKS : NEW_TESTAMENT_BOOKS;
    const sortedBooks = Object.keys(grouped[testament]).sort((a, b) => {
      const indexA = bookOrder.indexOf(a);
      const indexB = bookOrder.indexOf(b);
      return indexA - indexB;
    });
    
    const newGrouped = {} as Record<string, LibraryVerseCard[]>;
    sortedBooks.forEach(book => {
      newGrouped[book] = grouped[testament][book].sort((a, b) => 
        a.verse.reference.localeCompare(b.verse.reference)
      );
    });
    grouped[testament] = newGrouped;
  });

  return grouped;
};

export function Library() {
  const { isAuthenticated } = useAuth();
  const { verses, loading, error, refreshLibrary, clearError } = useLibrary();
  const [activeTestament, setActiveTestament] = useState<'Old Testament' | 'New Testament'>('New Testament');
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());

  // Group verses by testament and book
  const groupedVerses = useMemo(() => groupVersesByTestament(verses), [verses]);

  // Handle verse click for future detail view
  const handleVerseClick = (card: LibraryVerseCard) => {
    // TODO: Navigate to verse detail view
    console.log('Verse clicked:', card.verse.reference);
  };

  // Toggle book expansion
  const toggleBook = (bookName: string) => {
    const newExpanded = new Set(expandedBooks);
    if (newExpanded.has(bookName)) {
      newExpanded.delete(bookName);
    } else {
      newExpanded.add(bookName);
    }
    setExpandedBooks(newExpanded);
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-primary mb-6">Library</h1>
          <div className="bg-background border border-error/30 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-error font-medium">Error loading library</h3>
                <p className="text-error/80 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  clearError();
                  refreshLibrary();
                }}
                className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authentication required state
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-primary mb-6">Library</h1>
          <div className="bg-background border border-primary/20 rounded-xl p-8 text-center shadow-sm">
            <h3 className="text-primary font-medium mb-2">Sign in required</h3>
            <p className="text-primary/70">Please sign in to view your verse library.</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-primary mb-6">Library</h1>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-8 bg-primary/10 rounded-lg animate-pulse w-32"></div>
                <div className="bg-background border border-primary/10 rounded-xl p-6 animate-pulse shadow-sm">
                  <div className="h-6 bg-primary/10 rounded mb-4 w-1/3"></div>
                  <div className="h-4 bg-primary/10 rounded mb-3"></div>
                  <div className="h-4 bg-primary/10 rounded mb-3 w-2/3"></div>
                  <div className="h-3 bg-primary/10 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (verses.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-primary mb-6">Library</h1>
          <div className="bg-background border border-primary/10 rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-6">📚</div>
            <h3 className="text-primary font-medium mb-3 text-lg">Your library is empty</h3>
            <p className="text-primary/70 mb-8 max-w-md mx-auto">
              Start building your verse collection by adding your first verse.
            </p>
            <a
              href="/add"
              className="inline-flex items-center px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium shadow-sm"
            >
              Add Your First Verse
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {/* Sticky Header and Tabs */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 pt-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-primary">Library</h1>
          </div>

          {/* Testament Tabs */}
          <div className="flex border-b border-primary/20">
            <button
              onClick={() => setActiveTestament('Old Testament')}
              className={`px-4 py-3 font-medium transition-all duration-300 ease-in-out border-b-2 ${
                activeTestament === 'Old Testament'
                  ? 'text-primary border-accent'
                  : 'text-primary/60 hover:text-primary/80 border-transparent'
              }`}
            >
              Old Testament
            </button>
            <button
              onClick={() => setActiveTestament('New Testament')}
              className={`px-4 py-3 font-medium transition-all duration-300 ease-in-out border-b-2 ${
                activeTestament === 'New Testament'
                  ? 'text-primary border-accent'
                  : 'text-primary/60 hover:text-primary/80 border-transparent'
              }`}
            >
              New Testament
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content - starts immediately after border */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-8 sm:px-6 lg:px-8">

        {/* Books and Verses */}
        <div className="space-y-2 pb-8">
          {groupedVerses[activeTestament] && Object.entries(groupedVerses[activeTestament]).map(([book, bookVerses]) => (
            <div key={book} className="w-full">
              {/* Book Header */}
              <button
                onClick={() => toggleBook(book)}
                className="w-full px-4 py-3 text-left hover:bg-primary/5 transition-all duration-200 ease-in-out flex items-center justify-between rounded-lg"
              >
                <span className="font-medium text-primary text-lg">{book}</span>
                <svg
                  className={`w-5 h-5 text-primary/40 transition-all duration-300 ease-in-out transform ${
                    expandedBooks.has(book) ? 'rotate-180' : 'rotate-0'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </button>

              {/* Verses List with smooth expand/collapse */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                expandedBooks.has(book) ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="ml-6 pt-1">
                  {bookVerses.map((verseCard, index) => (
                    <button
                      key={verseCard.id}
                      onClick={() => handleVerseClick(verseCard)}
                      className="w-full px-4 py-3 text-left hover:bg-primary/5 transition-all duration-200 ease-in-out flex items-center justify-between rounded-lg"
                      style={{ 
                        animationDelay: expandedBooks.has(book) ? `${index * 50}ms` : '0ms',
                        animation: expandedBooks.has(book) ? 'fadeInUp 0.3s ease-out forwards' : 'none'
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <h4 className="font-medium text-primary mb-2 text-base">
                          {verseCard.verse.reference}
                        </h4>
                        <p className="text-sm text-primary/60 truncate leading-relaxed" style={{ fontFamily: 'Crimson Text, serif' }}>
                          {verseCard.verse.text}
                        </p>
                      </div>
                      <div className="ml-4 text-primary/40 flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-all duration-200 ease-in-out">
                          <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}