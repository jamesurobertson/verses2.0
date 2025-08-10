/**
 * Library page component for managing verse collections.
 * Users can view, organize, and manage their saved verses.
 */

import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary, type LibraryVerseCard } from './hooks/useLibrary';
import { encodeReference } from '../../utils/referenceEncoding';
import { ErrorCard } from '../../components/shared/ErrorCard';
import { EmptyState } from '../../components/shared/EmptyState';

// Biblical books organized by testament
const OLD_TESTAMENT_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
];

const NEW_TESTAMENT_BOOKS = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

// Function to extract book name from reference or return advisory label for invalid verses
const getBookFromReference = (reference: string, validationError?: string): string => {
  // If there's a validation error, return an advisory label instead of the invalid reference
  if (validationError) {
    return "⚠️ Invalid Reference";
  }

  // Extract book name before the first number
  const match = reference.match(/^([0-9]?\s*[a-zA-Z\s]+)/);
  return match ? match[1].trim() : 'Unknown';
};

// Function to determine testament
const getTestament = (bookName: string): 'Old Testament' | 'New Testament' | 'Needs Attention' => {
  if (OLD_TESTAMENT_BOOKS.includes(bookName)) return 'Old Testament';
  if (NEW_TESTAMENT_BOOKS.includes(bookName)) return 'New Testament';
  return 'Needs Attention'; // Default
};

// Function to group verses by testament and book, with special handling for invalid verses
const groupVersesByTestament = (verses: LibraryVerseCard[]) => {
  const grouped = verses.reduce((acc, verse) => {
    // Group invalid verses separately
    if (verse.verse.validationError) {
      const testament = "Needs Attention";
      const book = "⚠️ Invalid References";

      if (!acc[testament]) {
        acc[testament] = {};
      }
      if (!acc[testament][book]) {
        acc[testament][book] = [];
      }
      acc[testament][book].push(verse);
      return acc;
    }

    // Group valid verses normally
    const book = getBookFromReference(verse.verse.reference, verse.verse.validationError);
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
  const navigate = useNavigate();
  const { verses, loading, error, refreshLibrary, clearError } = useLibrary();
  const [activeTestament, setActiveTestament] = useState<'Old Testament' | 'New Testament' | 'Needs Attention'>('New Testament');
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());

  // Group verses by testament and book
  const groupedVerses = useMemo(() => groupVersesByTestament(verses), [verses]);

  // Auto-switch to "Needs Attention" if there are invalid verses and user is on a different tab
  const hasInvalidVerses = groupedVerses["Needs Attention"] && Object.keys(groupedVerses["Needs Attention"]).length > 0;

  // If there are invalid verses and we're not already on Needs Attention, switch to it
  useEffect(() => {
    if (hasInvalidVerses && activeTestament !== 'Needs Attention') {
      setActiveTestament('Needs Attention');
      // Auto-expand the invalid references section
      setExpandedBooks(new Set(['⚠️ Invalid References']));
    }
  }, [hasInvalidVerses, activeTestament]);

  // Handle verse click to navigate to detail view (only for valid verses)
  const handleVerseClick = (card: LibraryVerseCard) => {
    // Don't navigate to details for invalid verses - they need fixing first
    if (!card.verse.validationError) {
      navigate(`/library/${encodeReference(card.verse.reference)}`);
    }
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
      <ErrorCard
        title="Error loading library"
        message={error}
        onRetry={() => {
          clearError();
          refreshLibrary();
        }}
      />
    );
  }

  if (loading) return null

  if (verses.length === 0) {
    return (
      <EmptyState
        title="Your library is empty"
        description="Start memorizing by adding your first verse."
        actionText="Add Verse"
        actionHref="/add"
        icon="📚"
      />
    );
  }

  return (
    <>
      {/* Testament Tabs - Sticky within content area */}
      <div className="sticky z-10 bg-white" style={{ top: '0' }}>
        <div className="flex border-b border-primary/20">
          {/* Show Needs Attention tab first if there are invalid verses */}
          {hasInvalidVerses && (
            <button
              onClick={() => setActiveTestament('Needs Attention')}
              className={`px-4 py-3 font-medium transition-all duration-300 ease-in-out border-b-2 flex items-center gap-2 ${activeTestament === 'Needs Attention'
                ? 'text-orange-600 border-orange-500'
                : 'text-orange-500 hover:text-orange-600 border-transparent'
                }`}
            >
              <span>⚠️</span>
              Needs Attention
              <span className="bg-orange-500 text-white text-xs rounded-full px-2 py-0.5 ml-1">
                {Object.values(groupedVerses["Needs Attention"] || {}).flat().length}
              </span>
            </button>
          )}
          <button
            onClick={() => setActiveTestament('Old Testament')}
            className={`px-4 py-3 font-medium transition-all duration-300 ease-in-out border-b-2 ${activeTestament === 'Old Testament'
              ? 'text-primary border-accent'
              : 'text-primary/60 hover:text-primary/80 border-transparent'
              }`}
          >
            Old Testament
          </button>
          <button
            onClick={() => setActiveTestament('New Testament')}
            className={`px-4 py-3 font-medium transition-all duration-300 ease-in-out border-b-2 ${activeTestament === 'New Testament'
              ? 'text-primary border-accent'
              : 'text-primary/60 hover:text-primary/80 border-transparent'
              }`}
          >
            New Testament
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="pt-6 pb-8">

        {/* Books and Verses */}
        <div className="space-y-2 pb-8">
          {groupedVerses[activeTestament] && Object.entries(groupedVerses[activeTestament]).map(([book, bookVerses]) => (
            <div key={book} className="w-full">
              {/* Book Header */}
              <button
                onClick={() => toggleBook(book)}
                className="w-full px-4 py-1 text-left hover:bg-primary/5 transition-all duration-200 ease-in-out flex items-center justify-between rounded-lg"
              >
                <span className="font-medium text-primary text-lg">{book}</span>
                <svg
                  className={`w-5 h-5 text-primary/40 transition-all duration-300 ease-in-out transform ${expandedBooks.has(book) ? 'rotate-180' : 'rotate-0'
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </button>

              {/* Verses List with smooth expand/collapse */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedBooks.has(book) ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                }`}>
                <div className="ml-4 pt-1">
                  {bookVerses.map((verseCard, index) => (
                    <button
                      key={verseCard.id}
                      onClick={() => handleVerseClick(verseCard)}
                      className={`w-full px-4 py-3 text-left transition-all duration-200 ease-in-out flex items-center justify-between rounded-lg ${verseCard.verse.validationError
                        ? 'cursor-default'
                        : 'hover:bg-primary/5 cursor-pointer'
                        }`}
                      style={{
                        animationDelay: expandedBooks.has(book) ? `${index * 50}ms` : '0ms',
                        animation: expandedBooks.has(book) ? 'fadeInUp 0.3s ease-out forwards' : 'none'
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                          {verseCard.verse.validationError && (
                            <span className="text-orange-500 text-sm">⚠️</span>
                          )}
                          <h4 className={`font-medium text-base ${verseCard.verse.validationError ? 'text-orange-600' : 'text-primary'}`}>
                            {verseCard.verse.validationError ?
                              `${verseCard.verse.reference} (Invalid)` :
                              verseCard.verse.reference
                            }
                          </h4>
                        </div>
                        {verseCard.verse.validationError ? (
                          <div className="space-y-2">
                            <p className="text-sm text-orange-600 font-medium">
                              {verseCard.verse.validationError}
                            </p>
                            <p className="text-xs text-gray-500 italic">
                              Your manual entry: "{verseCard.verse.text}"
                            </p>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement fix reference logic
                                  console.log('Fix reference for:', verseCard.verse.reference);
                                }}
                                className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded hover:bg-orange-200 transition-colors font-medium"
                              >
                                Fix Reference
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement delete verse logic
                                  console.log('Delete verse:', verseCard.verse.reference);
                                }}
                                className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 transition-colors font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-primary/60 truncate leading-relaxed" style={{ fontFamily: 'Crimson Text, serif' }}>
                            {verseCard.verse.text}
                          </p>
                        )}
                      </div>
                      {!verseCard.verse.validationError && (
                        <div className="ml-4 text-primary/40 flex-shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-all duration-200 ease-in-out">
                            <polyline points="9,18 15,12 9,6"></polyline>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
