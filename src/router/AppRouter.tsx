import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { MobileNavigation } from '../components/MobileNavigation/MobileNavigation';
import { Review } from '../pages/Review/Review';
import { Library } from '../pages/Library/Library';
import { AddVerse } from '../pages/AddVerse/AddVerse';
import { Settings } from '../pages/Settings/Settings';
import { Auth } from '../pages/Auth/Auth';
import { NotFound } from '../pages/NotFound/NotFound';

/**
 * Mobile-first application router with protected routes.
 * Renders bottom navigation for mobile users and handles authentication flow.
 */
export function AppRouter() {
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show auth page
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  // Authenticated user routes with mobile navigation
  return (
    <div className="min-h-screen flex flex-col">
      {/* Main content area */}
      <main className="flex-1 pb-16 md:pb-0">
        <Routes>
          {/* Default route redirects to review */}
          <Route path="/" element={<Navigate to="/review" replace />} />
          
          {/* Main app routes */}
          <Route path="/review" element={<Review />} />
          <Route path="/library" element={<Library />} />
          <Route path="/add" element={<AddVerse />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* 404 page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Mobile bottom navigation */}
      <MobileNavigation />
    </div>
  );
}