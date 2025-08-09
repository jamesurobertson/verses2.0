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
import { detectNetworkStatus, isNetworkConnectivityError, getErrorMessage } from '../../../services/networkDetection';
import type { LocalDBSchema } from '../../../services/localDb';

// Form state interface
export interface AddVerseFormState {
  reference: string;
  verseText: string; // For manual text entry when offline
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
  showManualEntry: boolean; // Show manual text entry when offline
}

// Hook return interface
interface UseAddVerseReturn extends AddVerseFormState {
  setReference: (reference: string) => void;
  setVerseText: (text: string) => void;
  validateReference: (reference: string) => Promise<boolean>;
  addVerse: (reference: string, manualText?: string) => Promise<void>;
  clearState: () => void;
  clearError: () => void;
  clearSuccess: () => void;
  retryWithESV: () => void; // Retry ESV API call
}

export function useAddVerse(): UseAddVerseReturn {
  const { getCurrentUserId, getAccessToken, isAuthenticated, isAnonymous, mode, user } = useAuth();
  
  // Form state management
  const [state, setState] = useState<AddVerseFormState>({
    reference: '',
    verseText: '',
    isValidating: false,
    validationError: null,
    isLoading: false,
    error: null,
    success: null,
    showManualEntry: false
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
   * Updates the verse text input value (for local-only mode)
   */
  const setVerseText = useCallback((verseText: string) => {
    setState(prev => ({
      ...prev,
      verseText,
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
        }, 300);

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
   * Adds a verse - tries ESV API first, falls back to manual entry if network fails
   */
  const addVerse = useCallback(async (reference: string, manualText?: string) => {
    if (!reference.trim()) {
      setState(prev => ({
        ...prev,
        error: 'Please enter a Bible reference'
      }));
      return;
    }

    // If showing manual entry, require text
    if (state.showManualEntry && (!manualText || !manualText.trim())) {
      setState(prev => ({
        ...prev,
        error: 'Please enter the verse text'
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

      // Get current user ID and access token
      const userId = getCurrentUserId();
      const accessToken = await getAccessToken();
      
      // Debug auth state
      console.log('🔍 Auth Debug:', {
        userId: userId ? `Found (${userId.slice(0, 8)}...)` : 'None',
        accessToken: accessToken ? `Found (${accessToken.slice(0, 20)}...)` : 'None',
        isAuthenticated,
        isAnonymous,
        mode,
        userExists: !!user
      });

      // Check authentication state
      if (!isAuthenticated || !userId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Authentication required. Please wait for automatic sign-in or check your connection.'
        }));
        return;
      }

      // If authenticated but no access token, there might be a session issue
      if (isAuthenticated && !accessToken) {
        console.warn('⚠️ Authenticated user has no access token - possible session issue');
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Session issue detected. Please refresh the page or check your internet connection.',
          showManualEntry: true
        }));
        return;
      }

      // Try to add verse using ESV API first (if not already in manual mode)
      if (!state.showManualEntry) {
        try {
          const result = await dataService.addVerse(reference, userId, accessToken || undefined);

          if (result.success && result.local) {
            // Success - update with actual verse data
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
              reference: '', // Clear form
              verseText: '', // Clear manual text
              showManualEntry: false // Reset manual entry mode
            }));

            // Log sync warning if remote failed
            if (result.errors.remote) {
              console.warn('Verse saved locally but failed to sync to remote:', result.errors.remote);
            }
            return;
          }
        } catch (error) {
          console.error('ESV API Error:', error);
          
          // Handle different types of errors appropriately
          if (error instanceof ValidationError) {
            // ESV validation error (invalid reference) - don't show manual entry
            setState(prev => ({
              ...prev,
              isLoading: false,
              showManualEntry: false,
              error: error.message
            }));
            return;
          } 
          
          // Check if this is a true network connectivity issue
          const networkStatus = await detectNetworkStatus();
          const isConnectivityIssue = isNetworkConnectivityError(error, networkStatus);
          
          if (isConnectivityIssue || error instanceof NetworkError) {
            // True network connectivity issue - offer manual entry
            setState(prev => ({
              ...prev,
              isLoading: false,
              showManualEntry: true,
              error: 'Connection issue detected. Please check your internet connection or enter the verse text manually.'
            }));
            return;
          } else {
            // Service issue (ESV API down, server errors, etc.) - don't confuse with offline mode
            const errorMessage = getErrorMessage(error, networkStatus);
            setState(prev => ({
              ...prev,
              isLoading: false,
              showManualEntry: false, // Don't show manual entry for service issues
              error: errorMessage
            }));
            return;
          }
        }
      } else {
        // Manual entry mode - validate text before saving
        if (!manualText || manualText.trim() === '') {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Please enter the verse text'
          }));
          return;
        }

        // Manual entry mode - save with provided text
        const userId = getCurrentUserId();
        const result = await dataService.addVerse(reference, userId, undefined, manualText.trim());

        if (result.success && result.local) {
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
            reference: '', // Clear form
            verseText: '', // Clear manual text
            showManualEntry: false // Reset manual entry mode
          }));
          return;
        }
      }

      throw new Error('Failed to save verse');
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
        error: errorMessage,
        success: null // Clear optimistic success on error
      }));
    }
  }, [getCurrentUserId, getAccessToken, state.isLoading, state.showManualEntry]);

  /**
   * Retry with ESV API (exit manual entry mode)
   */
  const retryWithESV = useCallback(() => {
    setState(prev => ({
      ...prev,
      showManualEntry: false,
      error: null,
      verseText: '' // Clear manual text when switching back
    }));
  }, []);

  /**
   * Clears all form state
   */
  const clearState = useCallback(() => {
    setState({
      reference: '',
      verseText: '',
      isValidating: false,
      validationError: null,
      isLoading: false,
      error: null,
      success: null,
      showManualEntry: false
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
    setVerseText,
    validateReference,
    addVerse,
    clearState,
    clearError,
    clearSuccess,
    retryWithESV
  };
}