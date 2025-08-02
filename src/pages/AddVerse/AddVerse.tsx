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

  const handleBack = () => {
    navigate(-1);
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

  // Show success message if verse was added successfully
  if (success) {
    return (
      <div className="bg-background flex flex-col font-roboto">
        {/* Header with back button */}
        <div className="bg-background px-4 py-4 flex items-center">
          <button 
            onClick={handleBack}
            className="mr-3 p-2 text-primary hover:text-accent transition-colors"
            aria-label="Go back"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-medium text-primary">Add Verse</h1>
        </div>

        {/* Success content */}
        <div className="flex-1 px-4 py-6">
          <SuccessMessage
            reference={success.reference}
            text={success.text}
            onAddAnother={handleAddAnother}
            onGoToLibrary={handleGoToLibrary}
            onStartReviewing={handleStartReviewing}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex flex-col font-roboto">
      {/* Header with back button */}
      <div className="bg-background px-4 py-4 flex items-center">
        <button 
          onClick={handleBack}
          className="mr-3 p-2 text-primary hover:text-accent transition-colors"
          aria-label="Go back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-medium text-primary">Add Verse</h1>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col justify-between px-4 py-6">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Reference input */}
              <div>
                <label htmlFor="reference" className="block text-sm font-medium text-primary mb-3">
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
        <div className="w-full max-w-md mx-auto">
          <button
            type="submit"
            disabled={isLoading || !reference.trim() || !!validationError}
            onClick={handleSubmit}
            className="w-full bg-accent hover:bg-accent/90 disabled:bg-primary/20 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-lg text-base transition-colors shadow-sm"
          >
            {isLoading ? 'Adding Verse...' : 'Add Verse'}
          </button>
        </div>
      </div>
    </div>
  );
}