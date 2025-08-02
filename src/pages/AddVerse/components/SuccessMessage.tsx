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
  const containerStyles = `bg-green-50 border border-green-200 rounded-lg p-6 ${className}`.trim();
  
  // Truncate text if too long for display
  const displayText = text.length > 200 ? `${text.substring(0, 200)}...` : text;

  return (
    <div className={containerStyles} data-testid={testId} role="alert" aria-live="polite">
      {/* Success icon and title */}
      <div className="flex items-start mb-4">
        <div className="w-6 h-6 text-green-500 mr-3 mt-0.5" aria-hidden="true">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-green-800 mb-1">
            Verse Added Successfully!
          </h3>
          <p className="text-green-700">
            <span className="font-medium">{reference}</span> has been added to your collection.
          </p>
        </div>
      </div>

      {/* Verse text preview */}
      <div className="bg-white border border-green-200 rounded-md p-4 mb-6">
        <p className="text-gray-800 text-sm leading-relaxed italic">
          "{displayText}"
        </p>
        <p className="text-gray-600 text-sm mt-2 font-medium">
          — {reference} (ESV)
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {onAddAnother && (
          <Button
            variant="primary"
            onClick={onAddAnother}
            className="flex-1"
            data-testid="add-another-button"
          >
            Add Another Verse
          </Button>
        )}
        
        {onStartReviewing && (
          <Button
            variant="secondary"
            onClick={onStartReviewing}
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
            className="flex-1"
            data-testid="go-to-library-button"
          >
            View Library
          </Button>
        )}
      </div>

      {/* Additional helpful info */}
      <div className="mt-4 pt-4 border-t border-green-200">
        <p className="text-sm text-green-700">
          💡 Your verse is saved locally and will sync when you're online. 
          It's now ready for memorization practice!
        </p>
      </div>
    </div>
  );
};