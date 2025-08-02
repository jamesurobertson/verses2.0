import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

/**
 * Load environment variables from .env file
 */
function loadEnv() {
  try {
    const envFile = readFileSync('.env', 'utf8');
    const envVars = {};
    
    envFile.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && !key.startsWith('#')) {
        envVars[key.trim()] = value.trim();
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    return {};
  }
}

/**
 * Simple Node.js script to test Supabase database connectivity
 */
async function testConnection() {
  console.log('🔍 Testing Supabase database connection...\n');
  
  // Load environment variables
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
    console.error('   VITE_SUPABASE_ANON_KEY:', !!supabaseKey);
    process.exit(1);
  }
  
  console.log('✅ Environment variables found');
  console.log('   URL:', supabaseUrl);
  console.log('   Key:', supabaseKey.substring(0, 20) + '...\n');
  
  // Create client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test basic connection
  console.log('🔌 Testing basic connection...');
  try {
    const { data, error } = await supabase
      .from('verses')
      .select('count(*)', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      console.error('   Error details:', error);
      return false;
    }
    
    console.log('✅ Basic connection successful');
    console.log('   Verses table accessible, count:', data?.[0]?.count || 'unknown');
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    console.error('   Full error:', err);
    return false;
  }
  
  // Test table access
  console.log('\n📋 Testing table access...');
  const tables = ['verses', 'user_profiles', 'verse_cards', 'review_logs'];
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: accessible`);
      }
    } catch (err) {
      console.error(`❌ ${table}: ${err.message}`);
    }
  }
  
  console.log('\n🎉 Database connectivity test complete!');
  return true;
}

testConnection().catch(console.error);