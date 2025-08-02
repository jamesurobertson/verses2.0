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
    isLoading,
    isValidating,
    validationError,
    error,
    success,
    setReference,
    validateReference,
    addVerse,
    clearError,
    clearSuccess
  } = useAddVerse();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reference.trim()) {
      return;
    }

    await addVerse(reference);
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
  const handleRemoveVerse = async (verseCardId: number) => {
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
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 pt-6 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <h1 className="text-3xl font-bold text-primary">Add Verse</h1>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-8 sm:px-6 lg:px-8">
        {/* Main content area */}
        <div className="flex flex-col justify-between min-h-[60vh]">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Reference input */}
                <div>
                  <label htmlFor="reference" className="block font-medium text-primary text-lg mb-3">
                    Reference
                  </label>
                  <VerseReferenceInput
                    value={reference}
                    onChange={setReference}
                    onValidation={validateReference}
                    disabled={isLoading}
                    isValidating={isValidating}
                    validationError={validationError}
                    placeholder="John 3:16"
                    data-testid="verse-reference-input"
                  />
                </div>

                {/* Error display */}
                {error && (
                  <div className="bg-error/10 border border-error/20 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <p className="text-sm text-error font-medium">{error}</p>
                      <button
                        type="button"
                        onClick={clearError}
                        className="text-error hover:text-error/80 ml-2 text-lg leading-none font-bold"
                        aria-label="Dismiss error"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Bottom action button - positioned for thumb reach */}
          <div className="w-full max-w-md mx-auto mt-8">
            <button
              type="submit"
              disabled={isLoading || !reference.trim() || !!validationError}
              onClick={handleSubmit}
              className="w-full bg-accent hover:bg-accent/90 disabled:bg-primary/20 disabled:cursor-not-allowed font-medium py-4 px-6 rounded-lg text-base transition-colors shadow-sm"
            >
              {isLoading ? 'Adding Verse...' : 'Add Verse'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
