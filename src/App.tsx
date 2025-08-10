import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TimezoneProvider } from './contexts/TimezoneContext';
import { AppRouter } from './router/AppRouter';
import { PWAInstallPrompt } from './components/PWAInstallPrompt/PWAInstallPrompt';
import { useBackgroundSync } from './hooks/useBackgroundSync';
import './App.css';

/**
 * Bible Memory App
 * 
 * A spaced repetition app for Bible verse memorization with:
 * - Swipeable cards with mobile gestures
 * - Progressive spaced repetition system
 * - Offline PWA capabilities
 * - User authentication and sync
 * - Background sync for multi-device support
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TimezoneProvider>
          <AppContent />
        </TimezoneProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

/**
 * App content with background sync
 */
function AppContent() {
  // Enable background sync with default settings
  useBackgroundSync({
    syncOnOnline: true     // Sync when network reconnects
  });

  return (
    <>
      {/* <PWAInstallPrompt /> */}
      <AppRouter />
    </>
  );
}

export default App;
