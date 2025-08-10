import React, { useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { dataService } from '../../../services/dataService';
import { Button } from '../../../components/Button/Button';
import type { LocalDBSchema } from '../../../services/localDb';

interface InvalidReferenceEditorProps {
  item: {
    id: string;
    reference: string;
    reason: string;
  };
  onSuccess: (reference: string, verse: LocalDBSchema['verses'], verseCard: LocalDBSchema['verse_cards']) => void;
  onDelete: (reference: string) => void;
}

export const InvalidReferenceEditor: React.FC<InvalidReferenceEditorProps> = ({ item, onSuccess, onDelete }) => {
  const { getCurrentUserId, getAccessToken } = useAuth();
  const [editedReference, setEditedReference] = useState(item.reference);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTryAgain = useCallback(async () => {
    if (!editedReference.trim()) {
      setErrorMessage('Please enter a Bible reference');
      return;
    }

    setIsRetrying(true);
    setErrorMessage(null);

    try {
      const userId = getCurrentUserId();
      const accessToken = await getAccessToken();

      if (!userId) {
        setErrorMessage('Please sign in to add verses');
        return;
      }

      const result = await dataService.addVerse(editedReference.trim(), userId, accessToken || undefined);

      if (result.success && result.local) {
        setIsSuccess(true);
        onSuccess(result.local.verse.reference, result.local.verse, result.local.verseCard);
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to add this verse. Please check the reference.');
      }
    } finally {
      setIsRetrying(false);
    }
  }, [editedReference, getCurrentUserId, getAccessToken, onSuccess]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isRetrying) {
      handleTryAgain();
    }
  }, [handleTryAgain, isRetrying]);

  const handleDelete = useCallback(() => {
    onDelete(item.reference);
  }, [onDelete, item.reference]);

  if (isSuccess) {
    // Don't render anything when successful - the parent will handle the UI update
    return null;
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={editedReference}
            onChange={(e) => setEditedReference(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isRetrying}
            className="w-full px-3 py-2 border border-orange-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-50"
            placeholder="e.g., John 3:16 or Romans 8:28"
          />
          {errorMessage ? (
            <div className="text-xs text-red-600 mt-1">{errorMessage}</div>
          ) : (
            <div className="text-xs text-orange-600 mt-1">
              Please check the book name and chapter:verse format
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            size="small"
            onClick={handleTryAgain}
            disabled={isRetrying || !editedReference.trim()}
          >
            {isRetrying ? 'Trying...' : 'Try Again'}
          </Button>
          <Button
            variant="outline"
            size="small"
            onClick={handleDelete}
            disabled={isRetrying}
            className="text-gray-500 hover:text-red-600 border-gray-300 hover:border-red-300"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};