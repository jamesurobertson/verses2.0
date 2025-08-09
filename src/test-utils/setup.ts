import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Setup fake-indexeddb for Dexie testing
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
// @ts-ignore
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
// @ts-ignore
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

// Configure Dexie to use fake-indexeddb
Dexie.dependencies.indexedDB = new FDBFactory();
Dexie.dependencies.IDBKeyRange = FDBKeyRange;

// Add TextEncoder/TextDecoder for React Router
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Polyfill for structuredClone (needed for fake-indexeddb)
if (!(global as any).structuredClone) {
  (global as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.VITE_ESV_API_KEY = 'test_esv_api_key_123456789abcdef';
process.env.VITE_ESV_API_BASE_URL = 'https://api.esv.org/v3';
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
process.env.VITE_APP_TITLE = 'Bible Memory App';
process.env.VITE_APP_VERSION = '1.0.0';

// Mock IntersectionObserver for components that might use it
(global as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords() { return []; }
};

// Mock matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver for components that might use it
(global as any).ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Reset database between tests
beforeEach(async () => {
  // Reset fake-indexeddb for clean test state
  (global as any).indexedDB = new FDBFactory();
  Dexie.dependencies.indexedDB = (global as any).indexedDB;
  
  // Close any open databases
  if (typeof (global as any).db !== 'undefined') {
    await (global as any).db.close();
  }
});

// Setup console spy to track console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});