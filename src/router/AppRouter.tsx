import { Routes, Route } from 'react-router-dom';
import { useAuth } from "../contexts/AuthContext";
import { Review } from '../pages/Review/Review';
import { Library } from '../pages/Library/Library';
import { AddVerse } from '../pages/AddVerse/AddVerse';
import { Settings } from '../pages/Settings/Settings';
import { Auth } from '../pages/Auth/Auth';
import { NotFound } from '../pages/NotFound/NotFound';
import { VerseDetails } from '../pages/VerseDetails/VerseDetails';
import Spinner from '../components/Spinner/Spinner';
import Layout from '../pages/Layout';


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
    <Routes>
      <Route path="/" element={<Review />} />
      <Route path="/review" element={<Review />} />
      <Route path="/library" element={<Layout title="Library"><Library /></Layout>} />
      <Route path="/library/:reference" element={<Layout title="Verse Details"><VerseDetails /></Layout>} />
      <Route path="/add" element={<Layout title="Add Verse"><AddVerse /></Layout>} />
      <Route path="/settings" element={<Layout title="Settings"><Settings /></Layout>} />
      <Route path="/auth" element={<Auth />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
