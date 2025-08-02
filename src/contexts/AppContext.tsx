/**
 * App Context
 * 
 * Global state management for the Bible memory app.
 * Simple context without over-testing React internals.
 */

import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { VerseCardData } from '../types/verse';

interface AppState {
  verses: VerseCardData[];
  currentSession: {
    cards: VerseCardData[];
    isActive: boolean;
  };
  settings: {
    referenceDisplayMode: 'full' | 'first' | 'blank';
    preferredTranslation: string;
  };
}

type AppAction =
  | { type: 'ADD_VERSE'; payload: VerseCardData }
  | { type: 'UPDATE_VERSE'; payload: VerseCardData }
  | { type: 'START_SESSION'; payload: VerseCardData[] }
  | { type: 'END_SESSION' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppState['settings']> };

const initialState: AppState = {
  verses: [],
  currentSession: {
    cards: [],
    isActive: false,
  },
  settings: {
    referenceDisplayMode: 'full',
    preferredTranslation: 'ESV',
  },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_VERSE':
      return {
        ...state,
        verses: [...state.verses, action.payload],
      };
    
    case 'UPDATE_VERSE':
      return {
        ...state,
        verses: state.verses.map(verse =>
          verse.id === action.payload.id ? action.payload : verse
        ),
      };
    
    case 'START_SESSION':
      return {
        ...state,
        currentSession: {
          cards: action.payload,
          isActive: true,
        },
      };
    
    case 'END_SESSION':
      return {
        ...state,
        currentSession: {
          cards: [],
          isActive: false,
        },
      };
    
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
  addVerse: (verse: VerseCardData) => void;
  updateVerse: (verse: VerseCardData) => void;
  startSession: (cards: VerseCardData[]) => void;
  endSession: () => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const addVerse = (verse: VerseCardData) => {
    dispatch({ type: 'ADD_VERSE', payload: verse });
  };

  const updateVerse = (verse: VerseCardData) => {
    dispatch({ type: 'UPDATE_VERSE', payload: verse });
  };

  const startSession = (cards: VerseCardData[]) => {
    dispatch({ type: 'START_SESSION', payload: cards });
  };

  const endSession = () => {
    dispatch({ type: 'END_SESSION' });
  };

  const updateSettings = (settings: Partial<AppState['settings']>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        addVerse,
        updateVerse,
        startSession,
        endSession,
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