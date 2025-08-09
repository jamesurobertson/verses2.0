import { Routes, Route } from 'react-router-dom';
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
 * Mobile-first application router with optional authentication.
 * Supports local-only mode, anonymous users, and full authentication.
 * Renders bottom navigation for mobile users.
 */
export function AppRouter() {
  const { loading } = useAuth();

  // Show loading spinner during initial auth check
  if (loading) {
    return <Spinner />
  }

  // Always show main app - authentication is now optional
  return (
    <div className="h-screen flex flex-col">
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: '57px' }}>
        <Routes>
          {/* Main app routes - available in all modes */}
          <Route path="/" element={<Review />} />
          <Route path="/review" element={<Review />} />
          <Route path="/library" element={<Library />} />
          <Route path="/add" element={<AddVerse />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Verse details route */}
          <Route path="/library/:reference" element={<VerseDetails />} />

          {/* Auth route - accessible if needed */}
          <Route path="/auth" element={<Auth />} />

          {/* 404 page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Mobile bottom navigation */}
      <MobileNavigation />
    </div>
  );
}
