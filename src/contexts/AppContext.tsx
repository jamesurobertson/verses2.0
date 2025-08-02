/**
 * App Context
 * 
 * Global state management for the Bible memory app.
 * Simplified to handle only app-level settings.
 */

import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { ReferenceDisplayMode } from '../types/verse';

interface AppState {
  settings: {
    referenceDisplayMode: ReferenceDisplayMode;
    preferredTranslation: string;
  };
}

type AppAction = 
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppState['settings']> };

const initialState: AppState = {
  settings: {
    referenceDisplayMode: 'full',
    preferredTranslation: 'ESV',
  },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };
    
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const updateSettings = (settings: Partial<AppState['settings']>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        updateSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}