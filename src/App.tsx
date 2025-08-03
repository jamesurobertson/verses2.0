import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { TimezoneProvider } from './contexts/TimezoneContext';
import { AppRouter } from './router/AppRouter';
import './App.css';

/**
 * Bible Memory App
 * 
 * A spaced repetition app for Bible verse memorization with:
 * - Swipeable cards with mobile gestures
 * - Progressive spaced repetition system
 * - Offline PWA capabilities
 * - User authentication and sync
 */
function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <TimezoneProvider>
          <AppRouter />
        </TimezoneProvider>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
