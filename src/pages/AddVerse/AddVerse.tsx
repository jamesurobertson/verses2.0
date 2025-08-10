/**
 * Add Verse page component - redesigned to match Verses 2.0 design system
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddVerse } from './hooks/useAddVerse';
import { VerseReferenceInput } from './components/VerseReferenceInput';
import { SuccessMessage } from './components/SuccessMessage';
import { BatchSuccessMessage } from './components/BatchSuccessMessage';
import { Card } from '../../components/shared/Card';
import { useHybridLoading } from '../../hooks/useHybridLoading';
import { BatchResultsSkeleton } from '../../components/skeletons/BatchResultsSkeleton';

export function AddVerse() {
  const navigate = useNavigate();
  const [showExamples, setShowExamples] = useState(false);
  const {
    reference,
    verseText,
    isLoading,
    isValidating,
    validationError,
    error,
    success,
    batchSuccess,
    isBatch,
    showManualEntry,
    setReference,
    setVerseText,
    validateReference,
    addVerse,
    clearError,
    clearSuccess,
    clearBatchSuccess,
    retryWithESV
  } = useAddVerse();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reference.trim()) {
      return;
    }

    // Pass manual text if in manual entry mode
    await addVerse(reference, showManualEntry ? verseText : undefined);
  };

  const handleAddAnother = () => {
    clearSuccess();
    clearBatchSuccess();
  };

  const handleGoToLibrary = () => {
    navigate('/library');
  };

  const handleStartReviewing = () => {
    navigate('/review');
  };

  const handleExampleClick = (example: string) => {
    setReference(example);
    setShowExamples(false); // Hide examples after selection
  };

  // Handle removing a verse (archive it)
  const handleRemoveVerse = async (verseCardId: string) => {
    // TODO: Implement removeVerse in dataService or localDb
    // For now, just log and refresh
    console.log('Removing verse card:', verseCardId);
    // This would archive the verse card
    // await dataService.archiveVerseCard(verseCardId);
  };

  // Use hybrid loading to show skeleton with smart timing
  const { showSkeleton, isComplete } = useHybridLoading(isLoading);

  // Show skeleton while loading
  if (showSkeleton) {
    return (
      <BatchResultsSkeleton 
        cardCount={isBatch ? Math.min(reference.split(/[;,]/).length, 6) : 1}
      />
    );
  }

  // Show success message if verse was added successfully
  if (success && isComplete) {
    return (
      <SuccessMessage
        reference={success.reference}
        text={success.text}
        verseCard={success.verseCard}
        onAddAnother={handleAddAnother}
        onGoToLibrary={handleGoToLibrary}
        onStartReviewing={handleStartReviewing}
        onRemoveVerse={handleRemoveVerse}
      />
    );
  }

  // Show batch success message if batch verses were processed
  if (batchSuccess && isComplete) {
    return (
      <BatchSuccessMessage
        batchResult={batchSuccess}
        onAddAnother={handleAddAnother}
        onGoToLibrary={handleGoToLibrary}
        onStartReviewing={handleStartReviewing}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Main Form Card */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Reference Input Section */}
          <div>
            <label htmlFor="reference" className="block text-primary/70 text-sm mb-2">
              Bible Reference
            </label>
            <div className="space-y-1">
              <VerseReferenceInput
                value={reference}
                onChange={setReference}
                onValidation={validateReference}
                disabled={isLoading}
                isValidating={isValidating}
                validationError={validationError}
                showManualEntry={showManualEntry}
                placeholder={isBatch ? "e.g., John 3:16; Romans 8:28, 1 Peter 2:3" : "e.g., John 3:16 or Romans 8:28"}
                data-testid="verse-reference-input"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-primary/50">
                  {isBatch ? (
                    <>
                      <span className="font-medium text-accent">Multiple verses detected!</span> Use semicolons (;) or commas (,) to separate verses.
                    </>
                  ) : (
                    'Enter one or more verse references. Use semicolons (;) or commas (,) for multiple verses.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setShowExamples(!showExamples)}
                  className="text-xs text-accent hover:text-accent/80 underline transition-colors"
                >
                  {showExamples ? 'Hide Examples' : 'Show Examples'}
                </button>
              </div>
            </div>

            {/* Multiple References Examples - Collapsible */}
            {showExamples && (
              <div className="mt-4 bg-primary/5 rounded-lg p-4 border border-primary/10 transition-all duration-200 ease-in-out">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-primary">Multiple Reference Examples</span>
                </div>
                <span className="text-xs text-primary/50 italic">Click any example to try it</span>
              </div>
              
              <div className="space-y-3 text-xs">
                {/* Semicolon Examples */}
                <div>
                  <div className="font-medium text-primary mb-1 flex items-center gap-1">
                    <span className="text-accent">;</span> 
                    <span>Use semicolons for different verses:</span>
                  </div>
                  <div className="space-y-1 ml-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExampleClick('John 3:16; Romans 8:28; 1 Peter 2:3')}
                        className="bg-white hover:bg-accent/5 px-2 py-0.5 rounded border text-primary font-mono text-xs transition-colors cursor-pointer"
                      >
                        John 3:16; Romans 8:28; 1 Peter 2:3
                      </button>
                      <span className="text-primary/60">→ 3 separate cards</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExampleClick('Matthew 5:3-4; John 14:1-3')}
                        className="bg-white hover:bg-accent/5 px-2 py-0.5 rounded border text-primary font-mono text-xs transition-colors cursor-pointer"
                      >
                        Matthew 5:3-4; John 14:1-3
                      </button>
                      <span className="text-primary/60">→ 2 separate cards</span>
                    </div>
                  </div>
                </div>

                {/* Comma Examples */}
                <div>
                  <div className="font-medium text-primary mb-1 flex items-center gap-1">
                    <span className="text-accent">,</span> 
                    <span>Use commas for verses from same chapter:</span>
                  </div>
                  <div className="space-y-1 ml-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExampleClick('John 5:10,15,19,20')}
                        className="bg-white hover:bg-accent/5 px-2 py-0.5 rounded border text-primary font-mono text-xs transition-colors cursor-pointer"
                      >
                        John 5:10,15,19,20
                      </button>
                      <span className="text-primary/60">→ 1 card with multiple verses</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExampleClick('Matthew 5:3,4,5,6')}
                        className="bg-white hover:bg-accent/5 px-2 py-0.5 rounded border text-primary font-mono text-xs transition-colors cursor-pointer"
                      >
                        Matthew 5:3,4,5,6
                      </button>
                      <span className="text-primary/60">→ 1 card with multiple verses</span>
                    </div>
                  </div>
                </div>

                {/* Mixed Examples */}
                <div>
                  <div className="font-medium text-primary mb-1 flex items-center gap-1">
                    <span className="text-accent">Mixed:</span> 
                    <span>Combine both for complex input:</span>
                  </div>
                  <div className="space-y-1 ml-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExampleClick('John 5:1,5,10; Romans 8:28; 1 Pet 2:3')}
                        className="bg-white hover:bg-accent/5 px-2 py-0.5 rounded border text-primary font-mono text-xs transition-colors cursor-pointer"
                      >
                        John 5:1,5,10; Romans 8:28; 1 Pet 2:3
                      </button>
                      <span className="text-primary/60">→ 3 cards total</span>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="pt-2 border-t border-primary/10">
                  <div className="text-primary/60 space-y-1">
                    <div>💡 <strong>Tip:</strong> Different books = different cards (use ;)</div>
                    <div>💡 <strong>Tip:</strong> Same chapter = same card (use ,)</div>
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>

          {/* Manual Text Entry (when offline) */}
          {showManualEntry && (
            <div className="border-t border-primary/10 pt-6">
              <label htmlFor="verseText" className="block text-primary/70 text-sm mb-2">
                Verse Text
                <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                  Offline Mode
                </span>
              </label>
              <div className="space-y-2">
                <textarea
                  id="verseText"
                  value={verseText}
                  onChange={(e) => setVerseText(e.target.value)}
                  disabled={isLoading}
                  placeholder="Enter the verse text manually..."
                  className="w-full py-3 px-3 border border-primary/20 rounded-lg bg-white text-primary placeholder-primary/50 focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none text-sm"
                  data-testid="verse-text-input"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-primary/50">
                    You're offline. Enter the verse text manually or try reconnecting.
                  </p>
                  <button
                    type="button"
                    onClick={retryWithESV}
                    className="text-xs text-accent hover:text-accent/80 font-medium underline"
                  >
                    Try Online Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-error/5 border border-error/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-error" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-error font-medium">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-error hover:text-error/80 transition-colors"
                  aria-label="Dismiss error"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="border-t border-primary/10 pt-6">
            <button
              type="submit"
              disabled={
                isLoading ||
                !reference.trim() ||
                !!validationError ||
                (showManualEntry && !verseText.trim())
              }
              className="w-full bg-accent hover:bg-accent/90 disabled:bg-primary/20 disabled:cursor-not-allowed font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Adding Verse...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add to My Collection</span>
                </>
              )}
            </button>

            {/* Helper Text */}
            <p className="text-xs text-primary/50 text-center mt-2">
              Your verse will be added to your daily review schedule
            </p>
          </div>

        </form>
      </Card>

    </div>
  );
}
