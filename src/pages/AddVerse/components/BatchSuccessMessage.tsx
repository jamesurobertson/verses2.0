import React, { useState, useCallback } from 'react';
import { Button } from '../../../components/Button/Button';
import { Card } from '../../../components/shared/Card';
import { InvalidReferenceEditor } from './InvalidReferenceEditor';
import type { BatchVerseCreationResult } from '../../../services/dataService';

export interface BatchSuccessMessageProps {
  batchResult: BatchVerseCreationResult;
  onAddAnother?: () => void;
  onGoToLibrary?: () => void;
  onStartReviewing?: () => void;
  className?: string;
  'data-testid'?: string;
}

export const BatchSuccessMessage: React.FC<BatchSuccessMessageProps> = ({
  batchResult,
  onAddAnother,
  onGoToLibrary,
  onStartReviewing,
  className = '',
  'data-testid': testId,
}) => {
  // Make the component stateful to handle dynamic updates
  const [currentResult, setCurrentResult] = useState(batchResult);
  const { successful, failed, likelyInvalid, summary } = currentResult;

  const handleInvalidSuccess = useCallback((reference: string, verse: any, verseCard: any) => {
    setCurrentResult(prev => {
      // Remove from invalid list and add to successful list
      const newInvalid = prev.likelyInvalid.filter(item => item.reference !== reference);
      const newSuccessful = [...prev.successful, {
        id: `success_${Date.now()}`,
        reference,
        result: { local: { verse, verseCard } }
      }];
      
      // Update summary - recalculate all counts properly
      const newSummary = {
        ...prev.summary,
        successful: newSuccessful.length,
        likelyInvalid: newInvalid.length,
        failed: prev.failed.length, // Keep failed count unchanged
        duplicates: prev.summary.duplicates, // Keep duplicates unchanged
        total: prev.summary.total // Keep original total
      };

      return {
        ...prev,
        successful: newSuccessful,
        likelyInvalid: newInvalid,
        summary: newSummary
      };
    });
  }, []);

  const handleInvalidDelete = useCallback((reference: string) => {
    setCurrentResult(prev => {
      // Remove from invalid list
      const newInvalid = prev.likelyInvalid.filter(item => item.reference !== reference);
      
      // Update summary - reduce total count since we're removing an item entirely
      const newSummary = {
        ...prev.summary,
        likelyInvalid: newInvalid.length,
        total: prev.summary.total - 1 // Reduce total since item is deleted
      };

      return {
        ...prev,
        likelyInvalid: newInvalid,
        summary: newSummary
      };
    });
  }, []);
  
  return (
    <div className={`max-w-2xl ${className}`} data-testid={testId}>
      <Card className="space-y-6">
        {/* Success Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
            </div>
          </div>
          
          <h2 className="text-2xl font-semibold text-primary mb-2">
            {summary.successful > 0 ? (
              summary.successful === summary.total ? 'Verses Added!' : 
              summary.likelyInvalid > 0 ? 'Some Issues to Fix' : 'Verses Processed!'
            ) : (
              summary.likelyInvalid > 0 ? 'Please Check These References' : 'Processing Complete'
            )}
          </h2>
          
          <div className="text-primary/60 space-y-1">
            <p>
              {summary.successful > 0 && summary.successful === summary.total && (
                <span className="text-success font-medium">
                  {summary.successful} verse{summary.successful === 1 ? '' : 's'} added to your collection
                </span>
              )}
              {summary.successful > 0 && summary.successful < summary.total && (
                <span className="text-success font-medium">
                  {summary.successful} verse{summary.successful === 1 ? '' : 's'} added
                </span>
              )}
              {summary.successful > 0 && (summary.failed > 0 || summary.likelyInvalid > 0) && (
                <span className="text-primary/60"> • </span>
              )}
              {summary.failed > 0 && (
                <span className="text-error font-medium">
                  {summary.failed} failed
                </span>
              )}
              {summary.failed > 0 && summary.likelyInvalid > 0 && (
                <span className="text-primary/60"> • </span>
              )}
              {summary.likelyInvalid > 0 && (
                <span className="text-orange-600 font-medium">
                  {summary.likelyInvalid} invalid
                </span>
              )}
            </p>
          </div>
        </div>

        {/* All Verses - Errors at top, then successes */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {/* Invalid References - Editable (at top) */}
          {likelyInvalid.map((item) => (
            <InvalidReferenceEditor
              key={item.id}
              item={item}
              onSuccess={handleInvalidSuccess}
              onDelete={handleInvalidDelete}
            />
          ))}
          
          {/* Failed Verses (duplicates and errors) */}
          {failed.map((item) => (
            <div
              key={item.id}
              className="bg-error/5 border border-error/20 rounded-lg p-3"
            >
              <div className="font-medium text-error text-sm">
                {item.reference}
                {item.isDuplicate && (
                  <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                    Duplicate
                  </span>
                )}
              </div>
              <div className="text-xs text-error/70 mt-1">
                {item.error}
              </div>
            </div>
          ))}
          
          {/* Successful Verses (at bottom) */}
          {successful.map((item) => (
            <div
              key={item.id}
              className="bg-success/5 border border-success/20 rounded-lg p-3"
            >
              <div className="font-medium text-primary text-sm">
                {item.result.local?.verse.reference}
              </div>
              <div className="text-xs text-primary/60 mt-1 line-clamp-2">
                {item.result.local?.verse.text}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-primary/10">
          <Button
            variant="primary"
            onClick={onAddAnother}
            className="flex-1"
            data-testid="add-another-batch-button"
          >
            Add More Verses
          </Button>
          
          {successful.length > 0 && (
            <>
              <Button
                variant="secondary"
                onClick={onStartReviewing}
                className="flex-1"
                data-testid="start-reviewing-batch-button"
              >
                Start Reviewing
              </Button>
              
              <Button
                variant="outline"
                onClick={onGoToLibrary}
                className="flex-1"
                data-testid="go-to-library-batch-button"
              >
                View Library
              </Button>
            </>
          )}
        </div>

      </Card>
    </div>
  );
};