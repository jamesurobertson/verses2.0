/**
 * useAddVerse Hook Tests
 * 
 * Tests for add verse business logic and state management
 */

import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAddVerse } from '../../../src/pages/AddVerse/hooks/useAddVerse';

// Mock dependencies
jest.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../src/services/dataService', () => ({
  dataService: {
    addVerse: jest.fn(),
  },
  DuplicateVerseError: class DuplicateVerseError extends Error {
    constructor(message: string, existing: any) {
      super(message);
      this.name = 'DuplicateVerseError';
      this.existing = existing;
    }
    existing: any;
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  NetworkError: class NetworkError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NetworkError';
    }
  },
}));

jest.mock('../../../src/utils/bibleRefParser', () => ({
  validateBibleReference: jest.fn(),
  parseBibleReference: jest.fn(),
}));

// Import mocked modules
import { useAuth } from '../../../src/contexts/AuthContext';
import { dataService, DuplicateVerseError, ValidationError } from '../../../src/services/dataService';
import { validateBibleReference, parseBibleReference } from '../../../src/utils/bibleRefParser';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockDataService = dataService as jest.Mocked<typeof dataService>;
const mockValidateBibleReference = validateBibleReference as jest.MockedFunction<typeof validateBibleReference>;
const mockParseBibleReference = parseBibleReference as jest.MockedFunction<typeof parseBibleReference>;

describe('useAddVerse Hook', () => {
  const mockUser = { 
    id: 'test-user-123', 
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_sign_in_at: '2024-01-01T00:00:00Z',
    role: 'authenticated',
    phone: null,
    phone_confirmed_at: null,
    email_confirmed_at: '2024-01-01T00:00:00Z',
    confirmation_sent_at: null,
    confirmed_at: '2024-01-01T00:00:00Z',
    recovery_sent_at: null,
    action_link: null,
    email_change: null,
    email_change_sent_at: null,
    email_change_token: null,
    email_change_confirm_status: 0,
    banned_until: null,
    new_email: null,
    invited_at: null,
    new_phone: null,
    phone_change: null,
    phone_change_token: null,
    phone_change_sent_at: null,
    is_anonymous: false
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Default mocks
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    });

    mockValidateBibleReference.mockReturnValue(true);
    mockParseBibleReference.mockReturnValue({
      book: 'John',
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
      originalText: 'John 3:16'
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial state', () => {
    test('should initialize with empty state', () => {
      const { result } = renderHook(() => useAddVerse());

      expect(result.current.reference).toBe('');
      expect(result.current.isValidating).toBe(false);
      expect(result.current.validationError).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.success).toBe(null);
    });

    test('should provide all expected functions', () => {
      const { result } = renderHook(() => useAddVerse());

      expect(typeof result.current.setReference).toBe('function');
      expect(typeof result.current.validateReference).toBe('function');
      expect(typeof result.current.addVerse).toBe('function');
      expect(typeof result.current.clearState).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.clearSuccess).toBe('function');
    });
  });

  describe('setReference', () => {
    test('updates reference and clears errors', () => {
      const { result } = renderHook(() => useAddVerse());

      act(() => {
        result.current.setReference('John 3:16');
      });

      expect(result.current.reference).toBe('John 3:16');
      expect(result.current.validationError).toBe(null);
      expect(result.current.error).toBe(null);
    });
  });

  describe('validateReference', () => {
    test('validates valid reference successfully', async () => {
      const { result } = renderHook(() => useAddVerse());

      let validationResult: boolean;
      await act(async () => {
        validationResult = await result.current.validateReference('John 3:16');
      });

      // Fast forward timers for debouncing
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(validationResult!).toBe(true);
      expect(result.current.validationError).toBe(null);
      expect(result.current.reference).toBe('John 3:16'); // Normalized
    });

    test('handles invalid reference', async () => {
      mockValidateBibleReference.mockReturnValue(false);
      
      const { result } = renderHook(() => useAddVerse());

      let validationResult: boolean;
      await act(async () => {
        validationResult = await result.current.validateReference('Invalid Reference');
      });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(validationResult!).toBe(false);
      expect(result.current.validationError).toBe('Invalid Bible reference format');
    });

    test('handles parsing errors', async () => {
      mockParseBibleReference.mockImplementation(() => {
        throw new Error('Custom parsing error');
      });
      
      const { result } = renderHook(() => useAddVerse());

      let validationResult: boolean;
      await act(async () => {
        validationResult = await result.current.validateReference('John 3:16');
      });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(validationResult!).toBe(false);
      expect(result.current.validationError).toBe('Custom parsing error');
    });

    test('clears validation error for empty reference', async () => {
      const { result } = renderHook(() => useAddVerse());

      let validationResult: boolean;
      await act(async () => {
        validationResult = await result.current.validateReference('');
      });

      expect(validationResult!).toBe(false);
      expect(result.current.validationError).toBe(null);
      expect(result.current.isValidating).toBe(false);
    });
  });

  describe('addVerse', () => {
    test('successfully adds verse', async () => {
      const mockSuccessResult = {
        success: true,
        local: {
          verse: {
            id: 'verse-123',
            reference: 'John 3:16',
            text: 'For God so loved the world...',
            translation: 'ESV',
            aliases: ['john 3:16', 'jn 3:16'],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          verseCard: {
            id: 'card-123',
            user_id: mockUser.id,
            verse_id: 'verse-123',
            current_phase: 'daily' as const,
            phase_progress_count: 0,
            last_reviewed_at: null,
            next_due_date: '2024-01-01',
            assigned_day_of_week: null,
            assigned_week_parity: null,
            assigned_day_of_month: null,
            archived: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            current_streak: 0,
            best_streak: 0
          }
        },
        remote: null,
        errors: {}
      };

      mockDataService.addVerse.mockResolvedValue(mockSuccessResult);
      
      const { result } = renderHook(() => useAddVerse());

      await act(async () => {
        await result.current.addVerse('John 3:16');
      });

      expect(result.current.success).toBeDefined();
      expect(result.current.success!.reference).toBe('John 3:16');
      expect(result.current.success!.text).toBe('For God so loved the world...');
      expect(result.current.error).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.reference).toBe(''); // Form cleared
    });

    test('handles duplicate verse error', async () => {
      const duplicateError = new DuplicateVerseError('Verse already exists', {
        verse: {
          id: 'verse-123',
          reference: 'John 3:16',
          text: 'For God so loved the world...',
          translation: 'ESV',
          aliases: ['john 3:16'],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        verseCard: {
          id: 'card-123',
          user_id: 'user-123',
          verse_id: 'verse-123',
          current_phase: 'daily' as const,
          phase_progress_count: 0,
          last_reviewed_at: null,
          next_due_date: '2024-01-01',
          assigned_day_of_week: null,
          assigned_week_parity: null,
          assigned_day_of_month: null,
          archived: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          current_streak: 0,
          best_streak: 0
        }
      });
      mockDataService.addVerse.mockRejectedValue(duplicateError);
      
      const { result } = renderHook(() => useAddVerse());

      await act(async () => {
        await result.current.addVerse('John 3:16');
      });

      expect(result.current.error).toBe('Verse already exists');
      expect(result.current.success).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });

    test('handles validation error', async () => {
      const validationError = new ValidationError('Invalid reference');
      mockDataService.addVerse.mockRejectedValue(validationError);
      
      const { result } = renderHook(() => useAddVerse());

      await act(async () => {
        await result.current.addVerse('Invalid Reference');
      });

      expect(result.current.error).toBe('Invalid reference');
    });

    test('requires user to be logged in', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        loading: false,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
      });

      const { result } = renderHook(() => useAddVerse());

      await act(async () => {
        await result.current.addVerse('John 3:16');
      });

      expect(result.current.error).toBe('You must be logged in to add verses');
      expect(mockDataService.addVerse).not.toHaveBeenCalled();
    });

    test('requires non-empty reference', async () => {
      const { result } = renderHook(() => useAddVerse());

      await act(async () => {
        await result.current.addVerse('   ');
      });

      expect(result.current.error).toBe('Please enter a Bible reference');
      expect(mockDataService.addVerse).not.toHaveBeenCalled();
    });

    test('handles general errors', async () => {
      mockDataService.addVerse.mockRejectedValue(new Error('Network failure'));
      
      const { result } = renderHook(() => useAddVerse());

      await act(async () => {
        await result.current.addVerse('John 3:16');
      });

      expect(result.current.error).toBe('Network failure');
    });

    test('shows loading state during operation', async () => {
      let resolveAddVerse: (value: any) => void;
      const addVersePromise = new Promise(resolve => {
        resolveAddVerse = resolve;
      });
      mockDataService.addVerse.mockImplementation(() => addVersePromise);
      
      const { result } = renderHook(() => useAddVerse());

      act(() => {
        result.current.addVerse('John 3:16');
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAddVerse!({
          success: true,
          local: {
            verse: { 
              id: '1', 
              reference: 'John 3:16', 
              text: 'text', 
              translation: 'ESV', 
              aliases: ['john 3:16'],
              created_at: '', 
              updated_at: '' 
            },
            verseCard: { 
              id: '1', 
              user_id: '1', 
              verse_id: '1', 
              current_phase: 'daily' as const, 
              phase_progress_count: 0, 
              last_reviewed_at: null, 
              next_due_date: '2024-01-01',
              assigned_day_of_week: null,
              assigned_week_parity: null,
              assigned_day_of_month: null,
              archived: false, 
              created_at: '', 
              updated_at: '', 
              current_streak: 0, 
              best_streak: 0 
            }
          },
          remote: null,
          errors: {}
        });
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('State management functions', () => {
    test('clearState resets all state', () => {
      const { result } = renderHook(() => useAddVerse());

      // Set some state first
      act(() => {
        result.current.setReference('John 3:16');
      });

      act(() => {
        result.current.clearState();
      });

      expect(result.current.reference).toBe('');
      expect(result.current.isValidating).toBe(false);
      expect(result.current.validationError).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.success).toBe(null);
    });

    test('clearError clears only error state', () => {
      const { result } = renderHook(() => useAddVerse());

      // Set error and other state
      act(() => {
        result.current.setReference('John 3:16');
      });

      // Simulate error state (we can't easily set it directly)
      // This would be set by addVerse in real usage

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.reference).toBe('John 3:16'); // Other state preserved
    });

    test('clearSuccess clears only success state', () => {
      const { result } = renderHook(() => useAddVerse());

      act(() => {
        result.current.clearSuccess();
      });

      expect(result.current.success).toBe(null);
    });
  });
});