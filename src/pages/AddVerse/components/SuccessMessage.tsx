import React from 'react';
import { Button } from '../../../components/Button/Button';

export interface SuccessMessageProps {
  reference: string;
  text: string;
  onAddAnother?: () => void;
  onGoToLibrary?: () => void;
  onStartReviewing?: () => void;
  className?: string;
  'data-testid'?: string;
}

export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  reference,
  text,
  onAddAnother,
  onGoToLibrary,
  onStartReviewing,
  className = '',
  'data-testid': testId,
}) => {
  const containerStyles = `bg-success/10 border border-success/20 rounded-lg p-6 font-roboto ${className}`.trim();
  
  // Truncate text if too long for display
  const displayText = text.length > 200 ? `${text.substring(0, 200)}...` : text;

  return (
    <div className={containerStyles} data-testid={testId} role="alert" aria-live="polite">
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
      <div className="bg-background border border-primary/10 rounded-lg p-6 mb-8 shadow-sm">
        <p className="font-crimson text-primary text-lg leading-relaxed mb-3">
          "{displayText}"
        </p>
        <cite className="font-crimson text-primary/70 text-base font-medium">
          — {reference} (ESV)
        </cite>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-4">
        {onAddAnother && (
          <Button
            variant="primary"
            onClick={onAddAnother}
            size="large"
            className="w-full"
            data-testid="add-another-button"
          >
            Add Another Verse
          </Button>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3">
          {onStartReviewing && (
            <Button
              variant="secondary"
              onClick={onStartReviewing}
              size="medium"
              className="flex-1"
              data-testid="start-reviewing-button"
            >
              Start Reviewing
            </Button>
          )}
          
          {onGoToLibrary && (
            <Button
              variant="outline"
              onClick={onGoToLibrary}
              size="medium"
              className="flex-1"
              data-testid="go-to-library-button"
            >
              View Library
            </Button>
          )}
        </div>
      </div>

      {/* Additional helpful info */}
      <div className="mt-6 pt-6 border-t border-success/20">
        <p className="text-sm text-primary/60 font-roboto">
          Your verse is saved locally and will sync when you're online. 
          It's now ready for memorization practice!
        </p>
      </div>
    </div>
  );
};