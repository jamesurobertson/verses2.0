import { supabaseClient } from './supabase';

// Mock environment variables for testing
const mockEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
};

/**
 * Simple test to verify Supabase database connectivity.
 * 
 * This test checks:
 * 1. Client can connect to Supabase
 * 2. Basic query functionality works
 * 3. Database schema is accessible
 */
describe('Supabase Database Connectivity', () => {
  test('should connect to Supabase and perform basic query', async () => {
    // Test basic connection by checking the database version
    const { data, error } = await supabaseClient
      .from('verses')
      .select('count(*)', { count: 'exact' });

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('should have required environment variables', () => {
    expect(mockEnv.VITE_SUPABASE_URL).toBeDefined();
    expect(mockEnv.VITE_SUPABASE_ANON_KEY).toBeDefined();
    
    // Check URL format if URL exists
    if (mockEnv.VITE_SUPABASE_URL) {
      expect(mockEnv.VITE_SUPABASE_URL).toMatch(/^https:\/\/.+\.supabase\.co$/);
    }
  });

  test('should have access to expected tables', async () => {
    // Test each table exists by attempting a minimal query
    const tables = ['verses', 'user_profiles', 'verse_cards', 'review_logs'];
    
    for (const table of tables) {
      const { error } = await supabaseClient
        .from(table)
        .select('*')
        .limit(1);
      
      expect(error).toBeNull();
    }
  });
});