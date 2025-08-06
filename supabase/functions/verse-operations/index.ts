// Verse Operations Edge Function
// Handles secure verse lookup, creation, and alias management
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

// Types
interface VerseOperationRequest {
  operation: 'lookup' | 'create' | 'batch';
  reference: string;
  normalizedRef?: string;
  translation?: string;
  // Batch operation fields
  batchId?: string;
  operations?: Array<{
    id: string;
    type: 'lookup' | 'create';
    data: any;
  }>;
}

interface ESVPassageResponse {
  query: string;
  canonical: string;
  passages: string[];
}

// Initialize Supabase client with service role key for server-side operations
// For local development, use host.docker.internal to communicate between containers
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://host.docker.internal:54321';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Utility functions
function normalizeReferenceForLookup(reference: string): string {
  return reference
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w:.-]/g, '');
}

// Direct ESV API call - no intermediate edge function for better performance
async function callESVAPI(reference: string): Promise<ESVPassageResponse> {
  const esvApiKey = Deno.env.get('ESV_API_KEY');
  const esvApiBaseUrl = Deno.env.get('ESV_API_BASE_URL') || 'https://api.esv.org/v3';
  
  if (!esvApiKey) {
    throw new Error('ESV API key not configured');
  }

  // Sanitize reference
  const sanitizedReference = reference.replace(/\s+/g, ' ').trim();
  
  if (!sanitizedReference || sanitizedReference.length > 200) {
    throw new Error('Invalid Bible reference format');
  }

  const params = new URLSearchParams({
    q: sanitizedReference,
    'include-headings': 'false',
    'include-footnotes': 'false', 
    'include-verse-numbers': 'false',
    'include-short-copyright': 'false',
    'include-passage-references': 'false'
  });

  const response = await fetch(`${esvApiBaseUrl}/passage/text/?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${esvApiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.error(`ESV API Error: ${response.status}`);
    switch (response.status) {
      case 400:
        throw new Error('Invalid Bible reference. Please check the spelling and try again.');
      case 401:
        throw new Error('Unable to connect to Bible service.');
      case 429:
        throw new Error('Too many requests. Please wait a moment and try again.');
      default:
        throw new Error(`Unable to fetch verse. Server error ${response.status}`);
    }
  }

  const data = await response.json();
  
  // Validate response structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response from Bible service');
  }

  return data as ESVPassageResponse;
}

// ESV API verification function - ensures data integrity
async function verifyVerseWithESV(reference: string, text: string, translation: string = 'ESV'): Promise<boolean> {
  try {
    const esvResponse = await callESVAPI(reference);
    
    if (!esvResponse.passages || esvResponse.passages.length === 0) {
      return false;
    }

    const canonicalRef = esvResponse.canonical;
    const canonicalText = esvResponse.passages[0].trim();

    // ESV verses are immutable - must match exactly
    return canonicalRef === reference && canonicalText === text;
  } catch (error) {
    console.error('ESV verification failed:', error);
    return false;
  }
}

// Main verse lookup/creation function
async function handleVerseOperation(request: VerseOperationRequest, userId: string, userToken: string) {
  const { operation, reference, normalizedRef, translation = 'ESV' } = request;
  
  // Step 1: Always try lookup first (both operations need this)
  const normalizedInput = normalizedRef || normalizeReferenceForLookup(reference);
  
  const { data: lookupResult, error: lookupError } = await supabase
    .rpc('rpc_verse_lookup', {
      p_reference: reference,
      p_normalized: normalizedInput,
      p_user_id: userId || null,
      p_translation: translation
    });

  if (lookupError) {
    throw new Error(`Lookup failed: ${lookupError.message}`);
  }

  // If verse found, verify it against ESV API for data integrity
  if (lookupResult.verse) {
    // CRITICAL: Verify existing verse data against ESV API
    const isValid = await verifyVerseWithESV(
      lookupResult.verse.reference, 
      lookupResult.verse.text, 
      lookupResult.verse.translation
    );
    
    if (!isValid) {
      throw new Error(`Verse data integrity check failed for "${lookupResult.verse.reference}". This verse may have been corrupted.`);
    }

    // If this is just a lookup, return verified verse
    if (operation === 'lookup') {
      return {
        verse: lookupResult.verse,
        foundViaAlias: lookupResult.found_via_alias,
        userCard: lookupResult.user_card,
        source: 'database'
      };
    }

    // If this is create, check for existing user card
    if (operation === 'create') {
      if (lookupResult.user_card && !lookupResult.user_card.archived) {
        throw new Error(`Verse "${lookupResult.verse.reference}" already exists in your collection`);
      }
      
      return {
        verse: lookupResult.verse,
        foundViaAlias: lookupResult.found_via_alias,
        userCard: lookupResult.user_card,
        source: 'database'
      };
    }
  }

  // If operation is lookup and verse not found, return null
  if (operation === 'lookup') {
    return {
      verse: null,
      foundViaAlias: false,
      userCard: null,
      source: null
    };
  }

  // If operation is create and verse not found, fetch and verify from ESV API
  if (operation === 'create') {
    const esvResponse = await callESVAPI(reference);
    
    if (!esvResponse.passages || esvResponse.passages.length === 0) {
      throw new Error(`Invalid Bible reference: "${reference}". Please check the spelling and try again.`);
    }

    const canonicalRef = esvResponse.canonical;
    const verseText = esvResponse.passages[0].trim();

    // CRITICAL: Double-check that we get back exactly what we expect
    // This prevents any tampering or API inconsistencies
    if (!canonicalRef || !verseText) {
      throw new Error(`Invalid response from ESV API for reference: "${reference}"`);
    }

    // Additional verification: re-verify the canonical data
    const doubleCheck = await verifyVerseWithESV(canonicalRef, verseText, translation);
    if (!doubleCheck) {
      throw new Error(`ESV API consistency check failed for "${canonicalRef}". Please try again.`);
    }

    // Create verse using secure function with verified data
    const { data: createResult, error: createError } = await supabase
      .rpc('rpc_create_verse', {
        p_reference: canonicalRef,
        p_text: verseText,
        p_translation: translation
      });

    if (createError) {
      throw new Error(`Failed to create verse: ${createError.message}`);
    }

    if (createResult.error) {
      throw new Error(createResult.error);
    }

    // Create alias if input reference differs from canonical
    if (normalizedInput !== normalizeReferenceForLookup(canonicalRef)) {
      const { data: aliasResult, error: aliasError } = await supabase
        .rpc('rpc_create_alias', {
          p_alias: normalizedInput,
          p_verse_id: createResult.id
        });

      if (aliasError) {
        console.error('Failed to create alias:', aliasError);
        // Don't throw - verse creation succeeded
      }
    }

    return {
      verse: createResult,
      foundViaAlias: false,
      userCard: null,
      source: 'esv_api'
    };
  }

  throw new Error('Invalid operation');
}

// Batch operations handler
async function handleBatchOperations(operations: Array<{id: string, type: 'lookup' | 'create', data: any}>, userId: string, userToken: string) {
  const results = [];
  
  console.log(`🚀 Processing batch with ${operations.length} operations for user ${userId}`);
  
  for (const op of operations) {
    try {
      console.log(`📝 Processing operation ${op.id}: ${op.type}`);
      
      // Convert batch operation to individual VerseOperationRequest
      const individualRequest: VerseOperationRequest = {
        operation: op.type,
        reference: op.data.reference || '',
        normalizedRef: op.data.normalizedRef,
        translation: op.data.translation || 'ESV'
      };
      
      // Process individual operation using existing handler
      const result = await handleVerseOperation(individualRequest, userId, userToken);
      
      results.push({ 
        id: op.id, 
        success: true, 
        data: result 
      });
      
      console.log(`✅ Operation ${op.id} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Operation ${op.id} failed:`, error);
      
      results.push({ 
        id: op.id, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Calculate summary statistics
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`📊 Batch completed: ${successful} successful, ${failed} failed`);
  
  return {
    results,
    summary: {
      total: operations.length,
      successful,
      failed
    }
  };
}

// Edge Function Handler
serve(async (req) => {
  // Handle CORS preflight - THIS MUST BE FIRST!
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Ensure only POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // SECURITY: Verify user authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ 
      error: 'Authorization header required' 
    }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Create authenticated Supabase client
  const authenticatedSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: { Authorization: authHeader }
    }
  });

  // Verify the user token and get user info
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await authenticatedSupabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ 
      error: 'Invalid or expired token' 
    }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const requestData: VerseOperationRequest = await req.json();

    // Validate required fields
    if (!requestData.operation || !requestData.reference) {
      return new Response(JSON.stringify({ 
        error: 'Operation and reference are required' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate operation type
    if (!['lookup', 'create', 'batch'].includes(requestData.operation)) {
      return new Response(JSON.stringify({ 
        error: 'Operation must be "lookup", "create", or "batch"' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle batch operations separately
    if (requestData.operation === 'batch') {
      if (!requestData.operations || !Array.isArray(requestData.operations)) {
        return new Response(JSON.stringify({ 
          error: 'Batch operation requires operations array' 
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const batchResult = await handleBatchOperations(
        requestData.operations,
        user.id, // Use authenticated user ID from JWT - secure
        token // Use token from Authorization header - secure
      );

      return new Response(JSON.stringify({
        batchId: requestData.batchId || crypto.randomUUID(),
        ...batchResult
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle individual operations with authenticated user ID from JWT
    // Use user.id from verified JWT token - never trust client-sent userId
    const result = await handleVerseOperation(
      requestData,
      user.id, // Use authenticated user ID from JWT - secure
      token // Use token from Authorization header - secure
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Verse operation error:', error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});