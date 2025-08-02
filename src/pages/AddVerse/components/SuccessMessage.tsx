import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button/Button';

export interface SuccessMessageProps {
  reference: string;
  text: string;
  verseCard?: { id: number; verse_id: number };
  onAddAnother?: () => void;
  onGoToLibrary?: () => void;
  onStartReviewing?: () => void;
  onRemoveVerse?: (verseCardId: number) => Promise<void>;
  className?: string;
  'data-testid'?: string;
}

export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  reference,
  text,
  verseCard,
  onAddAnother,
  onGoToLibrary,
  onStartReviewing,
  onRemoveVerse,
  className = '',
  'data-testid': testId,
}) => {
  const navigate = useNavigate();
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Truncate text if too long for display
  const displayText = text.length > 200 ? `${text.substring(0, 200)}...` : text;

  const handleBack = () => {
    navigate(-1);
  };

  const handleRemoveVerse = async () => {
    console.log('handleRemoveVerse', verseCard, onRemoveVerse);
    if (!verseCard?.id || !onRemoveVerse) return;
    
    setIsRemoving(true);
    try {
      await onRemoveVerse(verseCard.id);
      // After removal, go back to the add form
      if (onAddAnother) {
        onAddAnother();
      }
    } catch (error) {
      console.error('Failed to remove verse:', error);
      // Show error to user - for now just log it
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="bg-background">

      {/* Scrollable Content */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-8 sm:px-6 lg:px-8">
        <div className={`bg-success/10 border border-success/20 rounded-lg p-6 font-roboto ${className}`.trim()} data-testid={testId} role="alert" aria-live="polite">
      {/* Success icon and title */}
      <div className="flex items-start mb-6">
        <div className="w-7 h-7 text-success mr-4 mt-0.5 flex-shrink-0" aria-hidden="true">
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-medium text-primary mb-2">
            Verse Added Successfully!
          </h3>
          <p className="text-primary/80">
            <span className="font-medium text-primary">{reference}</span> has been added to your collection.
          </p>
        </div>
      </div>

      {/* Verse text preview */}
      <div className="bg-background border border-primary/10 rounded-lg p-6 mb-8 shadow-sm relative">
        {/* Remove button */}
        {/* {verseCard && onRemoveVerse && ( */}
          <button
            onClick={handleRemoveVerse}
            disabled={isRemoving}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-primary/40 hover:text-error hover:bg-error/10 rounded-full transition-all duration-200"
            aria-label="Remove this verse"
            title="Remove this verse from your library"
          >
            {isRemoving ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        {/* )} */}
        
        <p className="text-primary text-lg leading-relaxed mb-3 pr-8" style={{ fontFamily: 'Crimson Text, serif' }}>
          "{displayText}"
        </p>
        <cite className="text-primary/70 text-base font-medium" style={{ fontFamily: 'Crimson Text, serif' }}>
          — {reference} (ESV)
        </cite>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-4">
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onAddAnother}
            size="medium"
            className="w-full"
            data-testid="add-another-button"
          >
            Add Another Verse
          </Button>
            <Button
              variant="outline"
              onClick={onGoToLibrary}
              size="medium"
              className="flex-1"
              data-testid="go-to-library-button"
            >
              View Library
            </Button>
            <Button
              variant="secondary"
              onClick={onStartReviewing}
              size="medium"
              className="flex-1"
              data-testid="start-reviewing-button"
            >
              Start Reviewing
            </Button>
          
        </div>
        </div>
        </div>
      </div>
    </div>
  );
};