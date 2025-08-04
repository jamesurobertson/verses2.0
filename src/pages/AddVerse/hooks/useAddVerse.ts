/**
 * useAddVerse Hook
 * 
 * Business logic for adding new verses with dual-write architecture,
 * real-time validation, and comprehensive error handling.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { dataService, DuplicateVerseError, ValidationError, NetworkError } from '../../../services/dataService';
import { normalizeReferenceForLookup } from '../../../utils/referenceNormalizer';
import type { LocalDBSchema } from '../../../services/localDb';

// Form state interface
export interface AddVerseFormState {
  reference: string;
  isValidating: boolean;
  validationError: string | null;
  isLoading: boolean;
  error: string | null;
  success: {
    reference: string;
    text: string;
    verse: LocalDBSchema['verses'];
    verseCard: LocalDBSchema['verse_cards'];
  } | null;
}

// Hook return interface
interface UseAddVerseReturn extends AddVerseFormState {
  setReference: (reference: string) => void;
  validateReference: (reference: string) => Promise<boolean>;
  addVerse: (reference: string) => Promise<void>;
  clearState: () => void;
  clearError: () => void;
  clearSuccess: () => void;
}

export function useAddVerse(): UseAddVerseReturn {
  const { user, getAccessToken } = useAuth();
  
  // Form state management
  const [state, setState] = useState<AddVerseFormState>({
    reference: '',
    isValidating: false,
    validationError: null,
    isLoading: false,
    error: null,
    success: null
  });

  // Debounced validation timer
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null);

  /**
   * Updates the reference input value
   */
  const setReference = useCallback((reference: string) => {
    setState(prev => ({
      ...prev,
      reference,
      validationError: null,
      error: null
    }));
  }, []);

  /**
   * Simple validation with debouncing - just check if input looks reasonable
   */
  const validateReference = useCallback(async (reference: string): Promise<boolean> => {
    if (!reference.trim()) {
      setState(prev => ({
        ...prev,
        validationError: null,
        isValidating: false
      }));
      return false;
    }

    setState(prev => ({
      ...prev,
      isValidating: true,
      validationError: null
    }));

    try {
      // Clear previous timer
      if (validationTimer) {
        clearTimeout(validationTimer);
      }

      // Debounce validation by 800ms - longer delay for better UX
      return new Promise((resolve) => {
        const timer = setTimeout(async () => {
          try {
            // Simple validation - just check if it has basic reference structure
            const normalized = normalizeReferenceForLookup(reference);
            const hasBasicStructure = /[a-z]+\s*\d+/.test(normalized); // book + chapter
            
            if (hasBasicStructure) {
              setState(prev => ({
                ...prev,
                isValidating: false,
                validationError: null
              }));
              resolve(true);
            } else {
              setState(prev => ({
                ...prev,
                isValidating: false,
                validationError: 'Please enter a Bible reference (e.g., "John 3:16" or "Gal 1")'
              }));
              resolve(false);
            }
          } catch (error) {
            setState(prev => ({
              ...prev,
              isValidating: false,
              validationError: 'Please enter a valid Bible reference'
            }));
            resolve(false);
          }
        }, 800);

        setValidationTimer(timer);
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isValidating: false,
        validationError: (error as Error).message
      }));
      return false;
    }
  }, [validationTimer]);

  /**
   * Adds a verse using the dual-write data service
   */
  const addVerse = useCallback(async (reference: string) => {
    if (!user) {
      setState(prev => ({
        ...prev,
        error: 'You must be logged in to add verses'
      }));
      return;
    }

    if (!reference.trim()) {
      setState(prev => ({
        ...prev,
        error: 'Please enter a Bible reference'
      }));
      return;
    }

    // Prevent concurrent calls
    if (state.isLoading) {
      return; // Another call is already in progress
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      success: null
    }));

    try {
      // Quick validation without debounce for submit
      const normalized = normalizeReferenceForLookup(reference);
      const hasBasicStructure = /[a-z]+\s*\d+/.test(normalized);
      if (!hasBasicStructure) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          success: null,
          error: 'Please enter a Bible reference (e.g., "John 3:16" or "Gal 1")'
        }));
        return;
      }

      // Show immediate success without verse text
      setState(prev => ({
        ...prev,
        success: {
          reference: reference,
          text: '', // Empty initially - will load in background
          verse: null as any,
          verseCard: null as any
        }
      }));

      // Get access token for secure API calls
      const accessToken = await getAccessToken();
      console.log('🔑 Access token retrieved:', accessToken ? 'Token found' : 'No token');
      if (!accessToken) {
        // Clear optimistic state on error
        setState(prev => ({ ...prev, success: null }));
        throw new Error('Unable to authenticate request');
      }

      // Add verse using data service - ESV API will handle parsing and formatting
      const result = await dataService.addVerse(reference, user.id, accessToken);

      if (result.success && result.local) {
        // Success - update with actual verse data (but user already saw success)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: null,
          success: {
            reference: result.local!.verse.reference,
            text: result.local!.verse.text,
            verse: result.local!.verse,
            verseCard: result.local!.verseCard
          },
          reference: '' // Clear form
        }));

        // Log sync warning if remote failed
        if (result.errors.remote) {
          console.warn('Verse saved locally but failed to sync to remote:', result.errors.remote);
        }
      } else {
        throw new Error('Failed to save verse');
      }
    } catch (error) {
      let errorMessage = 'An unexpected error occurred';

      if (error instanceof DuplicateVerseError) {
        errorMessage = error.message;
      } else if (error instanceof ValidationError) {
        errorMessage = error.message;
      } else if (error instanceof NetworkError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, [user, validateReference]);

  /**
   * Clears all form state
   */
  const clearState = useCallback(() => {
    setState({
      reference: '',
      isValidating: false,
      validationError: null,
      isLoading: false,
      error: null,
      success: null
    });
  }, []);

  /**
   * Clears only error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  /**
   * Clears only success state
   */
  const clearSuccess = useCallback(() => {
    setState(prev => ({
      ...prev,
      success: null
    }));
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
    };
  }, [validationTimer]);

  return {
    ...state,
    setReference,
    validateReference,
    addVerse,
    clearState,
    clearError,
    clearSuccess
  };
}