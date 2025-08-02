// TDD Step 1: RED - Write failing tests FIRST for mobile-first routing
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from '../../src/router/AppRouter';
import { useAuth } from '../../src/hooks/useAuth';

// Mock the auth hook since we don't have it yet
jest.mock('../../src/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
  })),
}));

// Mock page components since we don't have them yet
jest.mock('../../src/pages/Review/Review', () => ({
  Review: () => <div data-testid="review-page">Review Page</div>,
}));

jest.mock('../../src/pages/Library/Library', () => ({
  Library: () => <div data-testid="library-page">Library Page</div>,
}));

jest.mock('../../src/pages/AddVerse/AddVerse', () => ({
  AddVerse: () => <div data-testid="add-verse-page">Add Verse Page</div>,
}));

jest.mock('../../src/pages/Settings/Settings', () => ({
  Settings: () => <div data-testid="settings-page">Settings Page</div>,
}));

jest.mock('../../src/pages/Auth/Auth', () => ({
  Auth: () => <div data-testid="auth-page">Authentication Page</div>,
}));

describe('AppRouter (TDD)', () => {
  // These components don't exist yet - tests should fail!

  describe('Public Routes (Unauthenticated)', () => {
    test('should redirect to auth page when user is not logged in', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByTestId('auth-page')).toBeTruthy();
    });

    test('should redirect protected routes to auth when not logged in', () => {
      render(
        <MemoryRouter initialEntries={['/review']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByTestId('auth-page')).toBeTruthy();
    });
  });

  describe('Protected Routes (Authenticated)', () => {
    beforeEach(() => {
      // Mock authenticated user
      jest.mocked(useAuth).mockReturnValue({
        user: { 
          id: 'user-123', 
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2023-01-01T00:00:00Z'
        } as any,
        loading: false,
        isAuthenticated: true,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
      });
    });

    test('should render Review page at root path for authenticated users', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByTestId('review-page')).toBeTruthy();
    });

    test('should render Review page at /review', () => {
      render(
        <MemoryRouter initialEntries={['/review']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByTestId('review-page')).toBeTruthy();
    });

    test('should render Library page at /library', () => {
      render(
        <MemoryRouter initialEntries={['/library']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByTestId('library-page')).toBeTruthy();
    });

    test('should render AddVerse page at /add', () => {
      render(
        <MemoryRouter initialEntries={['/add']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByTestId('add-verse-page')).toBeTruthy();
    });

    test('should render Settings page at /settings', () => {
      render(
        <MemoryRouter initialEntries={['/settings']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByTestId('settings-page')).toBeTruthy();
    });

    test('should render 404 page for unknown routes', () => {
      render(
        <MemoryRouter initialEntries={['/unknown-route']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByText(/page not found/i)).toBeTruthy();
    });
  });

  describe('Mobile-First Navigation', () => {
    beforeEach(() => {
      // Mock authenticated user
      jest.mocked(useAuth).mockReturnValue({
        user: { 
          id: 'user-123', 
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2023-01-01T00:00:00Z'
        } as any,
        loading: false,
        isAuthenticated: true,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
      });
    });

    test('should include mobile navigation component', () => {
      render(
        <MemoryRouter initialEntries={['/review']}>
          <AppRouter />
        </MemoryRouter>
      );

      // Should have bottom navigation for mobile
      expect(screen.getByRole('navigation')).toBeTruthy();
    });

    test('should have proper mobile navigation structure', () => {
      render(
        <MemoryRouter initialEntries={['/review']}>
          <AppRouter />
        </MemoryRouter>
      );

      const navigation = screen.getByRole('navigation');
      
      // Should have links to main sections
      expect(navigation.textContent).toContain('Review');
      expect(navigation.textContent).toContain('Library');
      expect(navigation.textContent).toContain('Add');
      expect(navigation.textContent).toContain('Settings');
    });
  });

  describe('Loading States', () => {
    test('should show loading spinner when auth is loading', () => {
      jest.mocked(useAuth).mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(screen.getByText(/loading/i)).toBeTruthy();
    });
  });

  describe('Route Guards and Security', () => {
    test('should protect all main routes when not authenticated', () => {
      // Reset to unauthenticated state
      jest.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
      });

      const protectedRoutes = ['/review', '/library', '/add', '/settings'];
      
      protectedRoutes.forEach(route => {
        const { unmount } = render(
          <MemoryRouter initialEntries={[route]}>
            <AppRouter />
          </MemoryRouter>
        );

        expect(screen.getByTestId('auth-page')).toBeTruthy();
        unmount();
      });
    });
  });
});