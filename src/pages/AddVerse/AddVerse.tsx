/**
 * Add Verse page component - redesigned to match Verses 2.0 design system
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddVerse } from './hooks/useAddVerse';
import { VerseReferenceInput } from './components/VerseReferenceInput';
import { SuccessMessage } from './components/SuccessMessage';

export function AddVerse() {
  const navigate = useNavigate();
  const {
    reference,
    verseText,
    isLoading,
    isValidating,
    validationError,
    error,
    success,
    showManualEntry,
    setReference,
    setVerseText,
    validateReference,
    addVerse,
    clearError,
    clearSuccess,
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
  };

  const handleGoToLibrary = () => {
    navigate('/library');
  };

  const handleStartReviewing = () => {
    navigate('/review');
  };

  // Handle removing a verse (archive it)
  const handleRemoveVerse = async (verseCardId: string) => {
    // TODO: Implement removeVerse in dataService or localDb
    // For now, just log and refresh
    console.log('Removing verse card:', verseCardId);
    // This would archive the verse card
    // await dataService.archiveVerseCard(verseCardId);
  };

  // Show success message if verse was added successfully
  if (success) {
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

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-primary">Add Verse</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-8 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          
          {/* Main Form Card */}
          <div className="bg-background border border-primary/10 rounded-xl p-6 shadow-sm">
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
                    placeholder="e.g., John 3:16 or Romans 8:28"
                    data-testid="verse-reference-input"
                  />
                  <p className="text-xs text-primary/50">
                    Enter the verse reference you'd like to memorize
                  </p>
                </div>
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
                      className="w-full py-3 px-3 border border-primary/20 rounded-lg bg-white text-primary placeholder-primary/50 focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors min-h-[120px] resize-none text-sm"
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
          </div>

          {/* Quick Tips Card */}
          <div className="mt-6 bg-background border border-primary/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-primary mb-2">💡 Quick Tips</h3>
            <ul className="text-xs text-primary/70 space-y-1">
              <li>• Try "John 3:16", "Romans 8:28", or "Psalm 23:1"</li>
              <li>• Most common book abbreviations work (e.g., "Jn" for John)</li>
              <li>• Start with shorter verses if you're new to memorization</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
