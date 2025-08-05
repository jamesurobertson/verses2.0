/**
 * AddVerse Component Tests
 * 
 * Integration tests for the AddVerse page component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AddVerse } from './AddVerse';

// Mock the useAddVerse hook
const mockUseAddVerse = {
  reference: '',
  isValidating: false,
  validationError: null,
  isLoading: false,
  error: null,
  success: null,
  setReference: jest.fn(),
  validateReference: jest.fn(),
  addVerse: jest.fn(),
  clearState: jest.fn(),
  clearError: jest.fn(),
  clearSuccess: jest.fn(),
};

jest.mock('./hooks/useAddVerse', () => ({
  useAddVerse: () => mockUseAddVerse,
}));

// Mock react-router-dom navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Wrapper component for router context
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('AddVerse Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock to default state
    Object.assign(mockUseAddVerse, {
      reference: '',
      isValidating: false,
      validationError: null,
      isLoading: false,
      error: null,
      success: null,
      setReference: jest.fn(),
      validateReference: jest.fn().mockResolvedValue(true),
      addVerse: jest.fn(),
      clearState: jest.fn(),
      clearError: jest.fn(),
      clearSuccess: jest.fn(),
    });
  });

  describe('Initial render', () => {
    test('renders main form elements', () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      expect(screen.getByRole('heading', { name: /add verse/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/bible reference/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add verse/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    test('renders help section', () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      expect(screen.getByText(/tips for adding verses/i)).toBeInTheDocument();
      expect(screen.getByText(/try different formats/i)).toBeInTheDocument();
      expect(screen.getByText(/verses are saved locally first/i)).toBeInTheDocument();
    });

    test('submit button is disabled initially', () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const submitButton = screen.getByRole('button', { name: /add verse/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Form interactions', () => {
    test('calls setReference when input changes', async () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const input = screen.getByLabelText(/bible reference/i);
      await user.type(input, 'John 3:16');

      expect(mockUseAddVerse.setReference).toHaveBeenCalledWith('J');
      expect(mockUseAddVerse.setReference).toHaveBeenCalledWith('o');
      // ... each character typed
    });

    test('calls validateReference on input change', async () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const input = screen.getByLabelText(/bible reference/i);
      await user.type(input, 'John 3:16');

      expect(mockUseAddVerse.validateReference).toHaveBeenCalled();
    });

    test('calls addVerse on form submission', async () => {
      // Set up mock to have a valid reference
      Object.assign(mockUseAddVerse, {
        reference: 'John 3:16',
      });

      render(<AddVerse />, { wrapper: RouterWrapper });

      const submitButton = screen.getByRole('button', { name: /add verse/i });
      await user.click(submitButton);

      expect(mockUseAddVerse.addVerse).toHaveBeenCalledWith('John 3:16');
    });

    test('calls clearState when clear button is clicked', async () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(mockUseAddVerse.clearState).toHaveBeenCalled();
    });

    test('prevents form submission with empty reference', async () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const form = screen.getByRole('button', { name: /add verse/i }).closest('form');
      fireEvent.submit(form!);

      expect(mockUseAddVerse.addVerse).not.toHaveBeenCalled();
    });
  });

  describe('State-dependent rendering', () => {
    test('shows loading state', () => {
      Object.assign(mockUseAddVerse, {
        isLoading: true,
      });

      render(<AddVerse />, { wrapper: RouterWrapper });

      expect(screen.getByText(/adding verse to your collection/i)).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /adding verse/i })).toBeDisabled();
    });

    test('shows validation error', () => {
      Object.assign(mockUseAddVerse, {
        validationError: 'Invalid Bible reference format',
      });

      render(<AddVerse />, { wrapper: RouterWrapper });

      expect(screen.getByText(/invalid bible reference format/i)).toBeInTheDocument();
    });

    test('shows general error with dismiss button', async () => {
      Object.assign(mockUseAddVerse, {
        error: 'Network error occurred',
      });

      render(<AddVerse />, { wrapper: RouterWrapper });

      expect(screen.getByText(/error adding verse/i)).toBeInTheDocument();
      expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
      
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(mockUseAddVerse.clearError).toHaveBeenCalled();
    });

    test('shows success state', () => {
      Object.assign(mockUseAddVerse, {
        success: {
          reference: 'John 3:16',
          text: 'For God so loved the world...',
          verse: {
            id: 'verse-123',
            reference: 'John 3:16',
            text: 'For God so loved the world...',
            translation: 'ESV',
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
            archived: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            current_streak: 0,
            best_streak: 0
          }
        },
      });

      render(<AddVerse />, { wrapper: RouterWrapper });

      expect(screen.getByText(/verse added successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/john 3:16/i)).toBeInTheDocument();
      expect(screen.getByText(/for god so loved the world/i)).toBeInTheDocument();
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });

    test('disables submit button appropriately', () => {
      // Test various disabled states
      const testCases = [
        { state: { isLoading: true }, shouldBeDisabled: true },
        { state: { isValidating: true }, shouldBeDisabled: true },
        { state: { validationError: 'Some error' }, shouldBeDisabled: true },
        { state: { reference: '' }, shouldBeDisabled: true },
        { state: { reference: 'John 3:16' }, shouldBeDisabled: false },
      ];

      testCases.forEach(({ state, shouldBeDisabled }) => {
        Object.assign(mockUseAddVerse, {
          reference: '',
          isLoading: false,
          isValidating: false,
          validationError: null,
          ...state,
        });

        const { unmount } = render(<AddVerse />, { wrapper: RouterWrapper });
        
        const submitButton = screen.getByRole('button', { name: /add verse/i });
        if (shouldBeDisabled) {
          expect(submitButton).toBeDisabled();
        } else {
          expect(submitButton).toBeEnabled();
        }

        unmount();
      });
    });
  });

  describe('Success state navigation', () => {
    beforeEach(() => {
      Object.assign(mockUseAddVerse, {
        success: {
          reference: 'John 3:16',
          text: 'For God so loved the world...',
          verse: {
            id: 'verse-123',
            reference: 'John 3:16',
            text: 'For God so loved the world...',
            translation: 'ESV',
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
            archived: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            current_streak: 0,
            best_streak: 0
          }
        },
      });
    });

    test('handles add another verse action', async () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const addAnotherButton = screen.getByTestId('add-another-button');
      await user.click(addAnotherButton);

      expect(mockUseAddVerse.clearSuccess).toHaveBeenCalled();
      expect(mockUseAddVerse.clearState).toHaveBeenCalled();
    });

    test('navigates to library', async () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const libraryButton = screen.getByTestId('go-to-library-button');
      await user.click(libraryButton);

      expect(mockNavigate).toHaveBeenCalledWith('/library');
    });

    test('navigates to review', async () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const reviewButton = screen.getByTestId('start-reviewing-button');
      await user.click(reviewButton);

      expect(mockNavigate).toHaveBeenCalledWith('/review');
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels', () => {
      render(<AddVerse />, { wrapper: RouterWrapper });

      const input = screen.getByLabelText(/bible reference/i);
      expect(input).toBeInTheDocument();
    });

    test('shows error with proper ARIA role', () => {
      Object.assign(mockUseAddVerse, {
        error: 'Some error occurred',
      });

      render(<AddVerse />, { wrapper: RouterWrapper });

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(/some error occurred/i);
    });

    test('shows success message with proper ARIA role', () => {
      Object.assign(mockUseAddVerse, {
        success: {
          reference: 'John 3:16',
          text: 'For God so loved...',
          verse: {
            id: '1',
            reference: 'John 3:16',
            text: 'For God so loved...',
            translation: 'ESV',
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
            archived: false,
            created_at: '',
            updated_at: '',
            current_streak: 0,
            best_streak: 0
          }
        },
      });

      render(<AddVerse />, { wrapper: RouterWrapper });

      const successElement = screen.getByRole('alert');
      expect(successElement).toBeInTheDocument();
    });
  });
});