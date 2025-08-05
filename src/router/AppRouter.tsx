import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from "../contexts/AuthContext";
import { MobileNavigation } from '../components/MobileNavigation/MobileNavigation';
import { Review } from '../pages/Review/Review';
import { Library } from '../pages/Library/Library';
import { AddVerse } from '../pages/AddVerse/AddVerse';
import { Settings } from '../pages/Settings/Settings';
import { Auth } from '../pages/Auth/Auth';
import { NotFound } from '../pages/NotFound/NotFound';
import { VerseDetails } from '../pages/VerseDetails/VerseDetails';
import Spinner from '../components/Spinner/Spinner';

/**
 * Mobile-first application router with protected routes.
 * Renders bottom navigation for mobile users and handles authentication flow.
 */
export function AppRouter() {
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return <Spinner />
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
    <div className="h-screen flex flex-col">
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: '57px' }}>
        <Routes>
          {/* Default route redirects to review */}
          <Route path="/" element={<Navigate to="/review" replace />} />

          {/* Main app routes */}
          <Route path="/review" element={<Review />} />
          <Route path="/library" element={<Library />} />
          <Route path="/add" element={<AddVerse />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Verse details route */}
          <Route path="/verse/:verseCardId" element={<VerseDetails />} />

          {/* 404 page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Mobile bottom navigation */}
      <MobileNavigation />
    </div>
  );
}
