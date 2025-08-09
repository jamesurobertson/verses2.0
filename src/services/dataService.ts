import { db, type LocalDBSchema } from './localDb';
import { supabaseClient, db as supabaseDb } from './supabase';
import { normalizeReferenceForLookup } from '../utils/referenceNormalizer';
import { getTodayString, getUserTodayStringInTimezone } from '../utils/dateUtils';
// import { BatchSyncService, shouldUseBatchSync } from './batchSyncService'; // Currently unused

// Dual-write operation result interface
export interface DualWriteResult<T> {
  local: T | null;
  remote: T | null;
  errors: {
    local?: Error;
    remote?: Error;
  };
  success: boolean;
  isDuplicate?: boolean;
  existing?: T;
}

// Error types for better error handling
export class DuplicateVerseError extends Error {
  constructor(reference: string, existing: { verse: LocalDBSchema['verses']; verseCard: LocalDBSchema['verse_cards'] }) {
    super(`Verse "${reference}" already exists in your collection`);
    this.name = 'DuplicateVerseError';
    this.existing = existing;
  }
  existing: { verse: LocalDBSchema['verses']; verseCard: LocalDBSchema['verse_cards'] };
}

export class NetworkError extends Error {
  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
  originalError?: Error;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Batch sync interfaces and queue
export interface QueuedSyncOperation {
  id: string;                    // UUID for correlation  
  type: 'create_verse' | 'record_review' | 'update_profile';
  data: any;                    // Operation payload
  localRef: string;             // Local database reference
  userId: string;               // User context
  queuedAt: string;            // ISO timestamp
  retryCount: number;          // Retry tracking
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface BatchConfig {
  maxBatchSize: number;        // Default: 10 operations
  batchTimeoutMs: number;      // Default: 3000ms
  maxRetries: number;          // Default: 3 attempts
  networkAwareThrottling: boolean; // Adjust based on connection quality
}

export interface BatchDualWriteResult {
  batchId: string;
  operations: Array<{
    localId: string;
    operation: QueuedSyncOperation;
    result: DualWriteResult<any>;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    networkErrors: number;
    validationErrors: number;
  };
  processingTimeMs: number;
}

// Global batch sync state (exported for batch service)
export let syncQueue: QueuedSyncOperation[] = [];
export const batchConfig: BatchConfig = {
  maxBatchSize: 10,
  batchTimeoutMs: 3000,
  maxRetries: 3,
  networkAwareThrottling: true
};

// Secure verse operations using edge functions
async function secureVerseOperation(operation: 'lookup' | 'create', reference: string, normalizedRef: string, accessToken?: string): Promise<{
  verse: any | null;
  foundViaAlias: boolean;
  existingCard?: any | null;
  source?: string;
}> {
  try {
    const supabaseUrl = process.env.NODE_ENV === 'test' 
      ? process.env.VITE_SUPABASE_URL 
      : import.meta.env.VITE_SUPABASE_URL;
    
    // Use provided access token or get from session
    let token = accessToken;
    if (!token) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        throw new Error('User not authenticated');
      }
      token = session.access_token;
    }
    
    const requestBody = {
      operation,
      reference,
      normalizedRef,
      translation: 'ESV'
      // NO userId in body - extracted from JWT token in edge function
      // NO userToken in body - security best practice
    };
    
    console.log('🚀 Sending request to verse-operations edge function:', {
      operation,
      reference,
      normalizedRef,
      hasToken: !!token,
      tokenLength: token?.length || 0,
      supabaseUrl,
      requestBody: JSON.stringify(requestBody)
    });
    
    // Add timeout for better performance
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for edge functions
    
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/verse-operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Token only in header - secure
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('📡 Edge function response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError);
          throw new Error(`Edge function failed with status ${response.status}: ${response.statusText}`);
        }
        console.error('❌ Edge function returned error:', errorData);
        throw new Error(errorData.error || `Edge function failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Edge function success response:', {
        hasVerse: !!data.verse,
        verseId: data.verse?.id,
        verseReference: data.verse?.reference,
        hasUserCard: !!data.userCard,
        userCardId: data.userCard?.id,
        foundViaAlias: data.foundViaAlias,
        source: data.source
      });
      
      return {
        verse: data.verse,
        foundViaAlias: data.foundViaAlias,
        existingCard: data.userCard,
        source: data.source
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ Edge function call failed:', {
        error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack'
      });
      
      if (error instanceof Error && (
        error.name === 'AbortError' || 
        error.message.includes('aborted') ||
        error.message.includes('cancelled')
      )) {
        console.warn('⏱️ Edge function request timed out after 15 seconds');
        throw new NetworkError('Request timed out. Please check your connection and try again.', error);
      }
      // Check for fetch/network errors
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('ERR_NETWORK') ||
        error.message.includes('ERR_INTERNET_DISCONNECTED') ||
        error.message.includes('Load failed') ||
        error.message.includes('Network request failed')
      )) {
        console.warn('🌐 Network connectivity issue detected');
        throw new NetworkError('Unable to connect to server. Please check your internet connection.', error);
      }
      
      // Re-throw other errors (like validation errors from edge function)
      throw error;
    }
  } catch (error) {
    console.error('❌ Overall secure verse operation failed:', {
      error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Cache for recent lookups to avoid duplicate edge function calls within the same session
const lookupCache = new Map<string, { data: any; timestamp: number }>(); 
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes - verses don't change

async function cachedVerseOperation(operation: 'lookup' | 'create', reference: string, normalizedRef: string, accessToken?: string) {
  // Cache key now based on token (user is extracted from token in edge function)
  const tokenHash = accessToken ? accessToken.substring(0, 8) : 'anon';
  const cacheKey = `${operation}:${reference}:${normalizedRef}:${tokenHash}`;
  const cached = lookupCache.get(cacheKey);
  
  // Only cache lookups, not creates
  if (operation === 'lookup' && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  const result = await secureVerseOperation(operation, reference, normalizedRef, accessToken);
  
  // Only cache lookups
  if (operation === 'lookup') {
    lookupCache.set(cacheKey, { data: result, timestamp: Date.now() });
  }
  
  return result;
}

// Unified data service for dual-write operations
export const dataService: any = {
  /**
   * Adds a new verse with local-first approach:
   * 1. Check local database (verses + aliases table)
   * 2. If authenticated: Check remote database via edge functions
   * 3. If offline/no API: Create verse manually (user provides text)
   * 4. Dual-write pattern with graceful remote sync
   * ✅ NO async calls inside transactions (follows Dexie best practices)
   */
  async addVerse(
    reference: string,
    userId: string,
    accessToken?: string,
    manualText?: string
  ): Promise<
    DualWriteResult<{
      verse: LocalDBSchema['verses'];
      verseCard: LocalDBSchema['verse_cards'];
    }>
  > {
    const result: DualWriteResult<{
      verse: LocalDBSchema['verses'];
      verseCard: LocalDBSchema['verse_cards'];
    }> = {
      local: null,
      remote: null,
      errors: {},
      success: false
    };

    const normalizedInput = normalizeReferenceForLookup(reference);
    
    // Get user's timezone for consistent date calculations
    const userProfile = await db.user_profiles.where('user_id').equals(userId).first();
    const userTimezone = userProfile?.timezone || 'UTC';
    const nextDueDate = getUserTodayStringInTimezone(userTimezone);

    console.log('🔄 addVerse called with timezone information:', {
      reference,
      normalizedInput,
      userId: userId ? `${userId.slice(0, 8)}...` : 'None',
      userTimezone,
      nextDueDate,
      browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcToday: new Date().toISOString().split('T')[0],
      localToday: getTodayString(),
      hasAccessToken: !!accessToken,
      hasManualText: !!manualText
    });

    try {
      // STEP 1: Check Local Database (verses + aliases)
      // First check direct reference match
      let localVerse = await db.verses
        .where('[reference+translation]')
        .equals([reference, 'ESV'])
        .first();

      // If not found by reference, check aliases table
      if (!localVerse) {
        const aliasRecord = await db.aliases
          .where('alias')
          .equals(normalizedInput)
          .first();
        
        if (aliasRecord) {
          localVerse = await db.verses.get(aliasRecord.verse_id);
        }
      }

      // If verse found locally, check user's verse_cards
      if (localVerse) {
        const existingCard = await db.verse_cards
          .where('[user_id+verse_id]')
          .equals([userId, localVerse.id!])
          .first();

        if (existingCard) {
          if (existingCard.archived) {
            // Unarchive and reset as fresh verse_card
            await db.transaction('rw', db.verse_cards, async (tx) => {
              await tx.verse_cards.update(existingCard.id!, {
                archived: false,
                current_phase: 'daily',
                phase_progress_count: 0,
                current_streak: 0,
                next_due_date: nextDueDate,
                assigned_day_of_week: null,
                assigned_week_parity: null,
                assigned_day_of_month: null,
                updated_at: new Date().toISOString()
              });
            });
            
            const restoredCard = await db.verse_cards.get(existingCard.id!);
            result.local = { verse: localVerse, verseCard: restoredCard! };
            result.success = true;
            return result;
          } else {
            // Active card - throw duplicate error
            throw new DuplicateVerseError(localVerse.reference, {
              verse: localVerse,
              verseCard: existingCard
            });
          }
        }

        // User doesn't have this verse - add alias if needed and create verse_card
        console.log('🔄 Found verse locally, creating user card with timezone-aware date:', {
          verseReference: localVerse.reference,
          userTimezone,
          nextDueDate,
          browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          utcToday: new Date().toISOString().split('T')[0],
          localToday: getTodayString()
        });

        const existingAlias = await db.aliases
          .where('alias')
          .equals(normalizedInput)
          .first();

        if (!existingAlias) {
          // Add new alias in transaction
          await db.transaction('rw', db.aliases, async (tx) => {
            await tx.aliases.add({
              id: crypto.randomUUID(),
              alias: normalizedInput,
              verse_id: localVerse!.id!,
              created_at: new Date().toISOString()
            });
          });
        }

        // Create verse_card in transaction
        try {
          await db.transaction('rw', db.verse_cards, async (tx) => {
            const now = new Date().toISOString();
            const cardData: LocalDBSchema['verse_cards'] = {
              id: crypto.randomUUID(),
              user_id: userId,
              verse_id: localVerse!.id!,
              current_phase: 'daily',
              phase_progress_count: 0,
              last_reviewed_at: null,
              next_due_date: nextDueDate,
              assigned_day_of_week: null,
              assigned_week_parity: null,
              assigned_day_of_month: null,
              archived: false,
              current_streak: 0,
              best_streak: 0,
              created_at: now,
              updated_at: now
            };
            
            console.log('🔄 Creating verse card:', { 
              userId, 
              verseId: localVerse!.id,
              reference: localVerse!.reference,
              cardId: cardData.id 
            });
            
            await tx.verse_cards.add(cardData);
            result.local = { verse: localVerse!, verseCard: cardData };
            
            console.log('✅ Verse card created successfully');
          });
        } catch (error) {
          console.error('❌ Failed to create verse card:', error);
          throw error;
        }

        // Remote sync is no longer needed - edge functions handle it
        console.log('✅ Local verse card created (no remote sync needed, edge function handles it)');
        result.success = true;
        return result;
      }

      // STEP 2: Handle remote operations via edge function (authenticated mode only)
      if (accessToken) {
        console.log('🚀 Calling edge function for verse creation...', {
          reference,
          normalizedInput,
          hasAccessToken: !!accessToken
        });
        
        try {
          const { verse: foundRemoteVerse, userCard: remoteUserCard } = await cachedVerseOperation('create', reference, normalizedInput, accessToken);

          if (foundRemoteVerse) {
            console.log('✅ Edge function returned verse:', {
              verseId: foundRemoteVerse.id,
              reference: foundRemoteVerse.reference,
              hasUserCard: !!remoteUserCard,
              userCardId: remoteUserCard?.id,
              isArchived: remoteUserCard?.archived
            });

            // Handle different scenarios:
            if (remoteUserCard && remoteUserCard.archived) {
              // Unarchive existing card
              console.log('🔄 Unarchiving existing verse card...');
              await this.unarchiveVerseCard(remoteUserCard.id, userId, accessToken, foundRemoteVerse, normalizedInput, nextDueDate, result);
            } else if (!remoteUserCard) {
              // Create new verse card (both locally and remotely)
              console.log('🔄 Creating new verse card...');
              await this.createVerseCardEverywhere(foundRemoteVerse, normalizedInput, userId, nextDueDate, result, accessToken);
            } else {
              // This shouldn't happen - active card should have been caught by edge function
              throw new ValidationError(`Verse "${foundRemoteVerse.reference}" already exists in your collection`);
            }
            
            console.log('✅ Complete verse creation flow finished successfully');
            result.success = true;
            return result;
          } else {
            console.warn('⚠️ Edge function returned no verse - unexpected');
          }
        } catch (error) {
          console.error('❌ Edge function call failed in addVerse:', {
            error,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            message: error instanceof Error ? error.message : String(error)
          });
          
          // Re-throw network errors so the UI can handle them (switch to manual entry mode)
          if (error instanceof NetworkError) {
            console.log('🌐 Re-throwing NetworkError for manual entry mode');
            throw error;
          }
          
          // Handle ESV validation errors (invalid references)
          if (error instanceof Error && (
            error.message.includes('Invalid Bible reference') ||
            error.message.includes('not found') ||
            error.message.includes('does not exist') ||
            error.message.includes('invalid') ||
            error.message.includes('No passage found')
          )) {
            console.log('📖 Re-throwing validation error');
            throw new ValidationError('Please check the Bible reference and try again. Make sure the book name, chapter, and verse numbers are correct.');
          }
          
          // Re-throw duplicate verse errors (from edge function)
          if (error instanceof Error && error.message.includes('already exists in your collection')) {
            console.log('📚 Re-throwing duplicate verse error');
            throw new ValidationError(error.message);
          }
          
          console.log('🔄 Edge function failed, falling back to manual creation...');
          // Continue to manual creation below for other errors
        }
      } else {
        console.log('⚠️ No access token available, skipping edge function call');
      }

      // STEP 3: Manual verse creation (fallback when connection issues occur)
      if (!manualText || manualText.trim() === '') {
        throw new NetworkError('Connection issue detected. Please enter the verse text manually to continue.');
      }

      await this.createLocalOnlyVerse(reference, manualText.trim(), normalizedInput, userId, nextDueDate, result);
      result.success = true;
      return result;
    } catch (error) {
      console.log('🚨 dataService.addVerse: Final catch block', {
        error,
        message: error instanceof Error ? error.message : 'Unknown',
        isDuplicateVerseError: error instanceof DuplicateVerseError,
        isValidationError: error instanceof ValidationError,
        isNetworkError: error instanceof NetworkError,
        constructor: (error as Error).constructor.name
      });
      
      if (error instanceof DuplicateVerseError || error instanceof ValidationError || error instanceof NetworkError) {
        console.log('🔄 dataService.addVerse: Re-throwing special error type');
        throw error;
      }
      
      console.log('🚫 dataService.addVerse: Wrapping unknown error');
      if (!result.local) {
        result.errors.local = error as Error;
      }
      throw new Error(`Failed to add verse: ${(error as Error).message}`);
    }
  },

  // DEPRECATED: This function should no longer be used - edge functions handle remote creation
  async syncVerseToRemote(verse: LocalDBSchema['verses'], verseCard: LocalDBSchema['verse_cards'], result: any, accessToken?: string) {
    console.warn('⚠️ syncVerseToRemote called - this should not happen anymore! Edge functions handle remote creation.');
    console.log('🔄 Deprecated sync called for:', {
      verseId: verse.id,
      reference: verse.reference,
      verseCardId: verseCard.id,
      userId: verseCard.user_id,
      hasAccessToken: !!accessToken
    });

    // This function is deprecated - edge functions should handle all remote operations
    result.errors.remote = new Error('syncVerseToRemote is deprecated - edge functions should handle remote operations');
  },

  async syncRemoteVerseToLocal(remoteVerse: any, alias: string, userId: string, nextDueDate: string, result: any, remoteUserCard?: any) {
    // Create verse and card locally in transaction
    await db.transaction('rw', db.verses, db.aliases, db.verse_cards, async (tx) => {
      const now = new Date().toISOString();
      
      // Create verse with same ID as remote (maintained by edge functions)
      const localVerseData: LocalDBSchema['verses'] = {
        id: remoteVerse.id, // Use remote ID for consistency
        reference: remoteVerse.reference,
        text: remoteVerse.text,
        translation: remoteVerse.translation,
        is_verified: true, // Cloud verses are always ESV-verified
        created_at: remoteVerse.created_at || now,
        updated_at: remoteVerse.updated_at || now
      };
      await tx.verses.add(localVerseData);

      // Create alias if it doesn't exist locally
      const existingAlias = await tx.aliases.where('alias').equals(alias).first();
      if (!existingAlias) {
        await tx.aliases.add({
          id: crypto.randomUUID(),
          alias: alias,
          verse_id: localVerseData.id!,
          created_at: now
        });
      }

      // Create verse_card using data from remote (if provided) or defaults
      const cardData: LocalDBSchema['verse_cards'] = {
        id: crypto.randomUUID(), // Local ID (different from remote)
        user_id: userId,
        verse_id: localVerseData.id!,
        current_phase: remoteUserCard?.current_phase || 'daily',
        phase_progress_count: remoteUserCard?.phase_progress_count || 0,
        last_reviewed_at: remoteUserCard?.last_reviewed_at || null,
        next_due_date: remoteUserCard?.next_due_date || nextDueDate,
        assigned_day_of_week: remoteUserCard?.assigned_day_of_week || null,
        assigned_week_parity: remoteUserCard?.assigned_week_parity || null,
        assigned_day_of_month: remoteUserCard?.assigned_day_of_month || null,
        archived: remoteUserCard?.archived || false,
        current_streak: remoteUserCard?.current_streak || 0,
        best_streak: remoteUserCard?.best_streak || 0,
        created_at: remoteUserCard?.created_at || now,
        updated_at: remoteUserCard?.updated_at || now
      };
      
      console.log('🔄 Creating verse card (remote sync with edge function data):', { 
        userId, 
        verseId: localVerseData.id,
        reference: remoteVerse.reference,
        cardId: cardData.id,
        remoteCardId: remoteUserCard?.id
      });
      
      await tx.verse_cards.add(cardData);
      result.local = { verse: localVerseData, verseCard: cardData };
      
      console.log('✅ Verse card created successfully (remote sync)');
    });
  },

  /**
   * Creates verse card both locally and remotely (dual-write)
   */
  async createVerseCardEverywhere(verse: any, alias: string, userId: string, nextDueDate: string, result: any, accessToken?: string) {
    console.log('🔄 Creating verse card with timezone-aware date:', {
      nextDueDate,
      verseId: verse.id,
      reference: verse.reference
    });
    
    const now = new Date().toISOString();
    let localCard: LocalDBSchema['verse_cards'];
    
    // Step 1: Create locally first (optimistic)
    await db.transaction('rw', db.verses, db.aliases, db.verse_cards, async (tx) => {
      // Ensure verse exists locally
      const existingVerse = await tx.verses.get(verse.id);
      if (!existingVerse) {
        await tx.verses.add({
          id: verse.id,
          reference: verse.reference,
          text: verse.text,
          translation: verse.translation,
          is_verified: true,
          created_at: verse.created_at || now,
          updated_at: verse.updated_at || now
        });
      }

      // Add alias if it doesn't exist
      const existingAlias = await tx.aliases.where('alias').equals(alias).first();
      if (!existingAlias) {
        await tx.aliases.add({
          id: crypto.randomUUID(),
          alias: alias,
          verse_id: verse.id,
          created_at: now
        });
      }

      // Create verse_card locally
      const cardData: LocalDBSchema['verse_cards'] = {
        id: crypto.randomUUID(),
        user_id: userId,
        verse_id: verse.id,
        current_phase: 'daily',
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: nextDueDate,
        assigned_day_of_week: null,
        assigned_week_parity: null,
        assigned_day_of_month: null,
        archived: false,
        current_streak: 0,
        best_streak: 0,
        created_at: now,
        updated_at: now
      };
      await tx.verse_cards.add(cardData);
      localCard = cardData;
    });

    result.local = { verse, verseCard: localCard! };
    
    // Step 2: Create remotely (graceful degradation)
    if (accessToken) {
      try {
        console.log('🔄 Creating verse card remotely via Supabase with data:', {
          user_id: userId.slice(0, 8) + '...',
          verse_id: verse.id,
          next_due_date: nextDueDate,
          current_phase: 'daily'
        });
        
        const { error: cardError, data: remoteCardData } = await supabaseDb.verseCards.create({
          user_id: userId,
          verse_id: verse.id,
          current_phase: 'daily',
          phase_progress_count: 0,
          last_reviewed_at: null,
          next_due_date: nextDueDate,
          assigned_day_of_week: null,
          assigned_week_parity: null,
          assigned_day_of_month: null,
          archived: false,
          current_streak: 0,
          best_streak: 0
        });
        
        console.log('📊 Remote verse card creation result:', {
          success: !cardError,
          error: cardError?.message,
          remoteCardId: remoteCardData?.id,
          remoteDueDate: remoteCardData?.next_due_date
        });

        if (cardError) {
          console.error('❌ Failed to create verse card remotely:', cardError);
          result.errors.remote = new NetworkError('Failed to sync verse card to remote', cardError);
        } else {
          console.log('✅ Verse card created remotely successfully');
        }
      } catch (error) {
        console.error('❌ Remote verse card creation failed:', error);
        result.errors.remote = new NetworkError('Failed to sync verse card to remote', error as Error);
      }
    }
  },

  /**
   * Unarchives an existing verse card both locally and remotely
   */
  async unarchiveVerseCard(cardId: string, userId: string, _accessToken: string, verse: any, alias: string, nextDueDate: string, result: any) {
    const now = new Date().toISOString();
    
    // Step 1: Update remotely first
    try {
      console.log('🔄 Unarchiving verse card remotely...');
      const { error: unarchiveError } = await supabaseDb.verseCards.update(cardId, {
        archived: false,
        current_phase: 'daily',
        phase_progress_count: 0,
        current_streak: 0,
        next_due_date: nextDueDate,
        assigned_day_of_week: null,
        assigned_week_parity: null,
        assigned_day_of_month: null,
        updated_at: now
      }, userId);

      if (unarchiveError) {
        throw unarchiveError;
      }
      console.log('✅ Verse card unarchived remotely');
    } catch (error) {
      console.error('❌ Failed to unarchive verse card remotely:', error);
      throw new Error(`Failed to restore verse: ${(error as Error).message}`);
    }

    // Step 2: Sync to local database
    await this.syncRemoteVerseToLocal(verse, alias, userId, nextDueDate, result);
  },

  async createLocalOnlyVerse(reference: string, text: string, alias: string, userId: string, nextDueDate: string, result: any) {
    await db.transaction('rw', db.verses, db.aliases, db.verse_cards, async (tx) => {
      const now = new Date().toISOString();
      
      // Create verse locally only
      const localVerseData: LocalDBSchema['verses'] = {
        id: crypto.randomUUID(),
        reference: reference,
        text: text,
        translation: 'ESV',
        is_verified: false, // Manual entry - needs ESV validation later
        created_at: now,
        updated_at: now
      };
      await tx.verses.add(localVerseData);

      // Create alias if it doesn't exist locally
      const existingAlias = await tx.aliases.where('alias').equals(alias).first();
      if (!existingAlias) {
        await tx.aliases.add({
          id: crypto.randomUUID(),
          alias: alias,
          verse_id: localVerseData.id!,
          created_at: now
        });
      }

      // Create verse_card
      const cardData: LocalDBSchema['verse_cards'] = {
        id: crypto.randomUUID(),
        user_id: userId,
        verse_id: localVerseData.id!,
        current_phase: 'daily',
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: nextDueDate,
        assigned_day_of_week: null,
        assigned_week_parity: null,
        assigned_day_of_month: null,
        archived: false,
        current_streak: 0,
        best_streak: 0,
        created_at: now,
        updated_at: now
      };
      
      console.log('🔄 Creating verse card (local only):', { 
        userId, 
        verseId: localVerseData.id,
        reference: localVerseData.reference,
        cardId: cardData.id 
      });
      
      await tx.verse_cards.add(cardData);
      result.local = { verse: localVerseData, verseCard: cardData };
      
      console.log('✅ Verse card created successfully (local only)');
    });
  },

  // This method is no longer needed - edge functions handle verse creation
  async createNewVerseEverywhere(_reference: string, _text: string, _alias: string, _userId: string, _nextDueDate: string, _result: any) {
    // Edge functions now handle verse creation securely
    // This method should not be called in the new architecture
    throw new Error('Verse creation is now handled by secure edge functions');
  },

  /**
   * Records a review log entry with dual-write strategy
   * Skips remote sync when no access token (offline or session issues)
   * ✅ FIXED: Transaction contains only Dexie operations, external calls outside
   */
  async recordReview(
    verseCardId: string,
    userId: string,
    wasSuccessful: boolean,
    reviewTimeSeconds?: number,
    accessToken?: string
  ): Promise<DualWriteResult<LocalDBSchema['review_logs']>> {
    const result: DualWriteResult<LocalDBSchema['review_logs']> = {
      local: null,
      remote: null,
      errors: {},
      success: false
    };

    try {
      // Step 1: Create review log in transaction (no external calls)
      let localLog: LocalDBSchema['review_logs'];
      
      await db.transaction('rw', db.review_logs, async (tx) => {
        // Create review log within transaction - allow multiple reviews per day
        // The database trigger (process_review_comprehensive) handles count_toward_progress logic
        const now = new Date().toISOString();
        const logData: LocalDBSchema['review_logs'] = {
          id: crypto.randomUUID(),
          user_id: userId,
          verse_card_id: verseCardId,
          was_successful: wasSuccessful,
          counted_toward_progress: false, // Will be updated by trigger if applicable
          review_time_seconds: reviewTimeSeconds || null,
          created_at: now
        };
        await tx.review_logs.add(logData);
        localLog = logData;
      });

      result.local = localLog!;

      // Step 2: Database trigger will handle all verse card updates automatically
      // including: phase progression, due dates, streaks, timestamps, etc.
      console.log('Review recorded:', {
        verseCardId,
        wasSuccessful,
        reviewTime: reviewTimeSeconds
      });

      // Step 3: Sync to remote (graceful degradation on failure) - OUTSIDE transaction
      // Skip remote sync if no access token (local-only mode)
      if (accessToken) {
        try {
          // Get local references for remote sync
          const localCard = await db.verse_cards.get(verseCardId);
          if (localCard) {
            const localVerse = await db.verses.get(localCard.verse_id);
            if (localVerse) {
              // Find remote verse by reference+translation
              const { data: remoteVerses, error: verseSelectError } = await supabaseClient
                .from('verses')
                .select('id')
                .eq('reference', localVerse.reference)
                .eq('translation', localVerse.translation);

              if (verseSelectError) {
                throw verseSelectError;
              }

              if (remoteVerses && remoteVerses.length > 0) {
                const remoteVerse = remoteVerses[0];
                // Find remote card by user_id + verse_id
                const { data: remoteCards, error: cardSelectError } = await supabaseClient
                  .from('verse_cards')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('verse_id', remoteVerse.id);

                if (cardSelectError) {
                  throw cardSelectError;
                }

                const remoteCard = remoteCards && remoteCards.length > 0 ? remoteCards[0] : null;

                if (remoteCard) {
                  // Create review log remotely
                  const { error: reviewError } = await supabaseClient
                    .from('review_logs')
                    .insert({
                      user_id: userId,
                      verse_card_id: remoteCard.id,
                      was_successful: wasSuccessful,
                      counted_toward_progress: false, // Remote trigger will handle this
                      review_time_seconds: reviewTimeSeconds || null
                    });

                  if (reviewError) {
                    throw reviewError;
                  }
                  console.log('Review synced to remote successfully');
                }
              }
            }
          }
          result.remote = null; // We don't return the remote log object
        } catch (error) {
          result.errors.remote = new NetworkError(
            'Failed to sync review log to remote database - data saved locally',
            error as Error
          );
          // Don't throw here - local operation succeeded
        }
      } else {
        console.log('Skipping remote review sync - local-only mode');
      }

      result.success = true;
      return result;

    } catch (error) {
      result.errors.local = error as Error;
      throw new Error(`Failed to record review: ${(error as Error).message}`);
    }
  },

  /**
   * Syncs local changes to remote database using content-based matching
   * ✅ FIXED: External API calls separate from any transaction operations
   */
  async syncToRemote(userId: string, lastSyncTimestamp?: string): Promise<{
    synced: number;
    failed: number;
    errors: Error[];
  }> {
    const result = {
      synced: 0,
      failed: 0,
      errors: [] as Error[]
    };

    try {
      console.log('🔄 Starting comprehensive sync to remote...', {
        userId: userId.slice(0, 8) + '...',
        lastSyncTimestamp
      });

      // PART 1: Sync unverified verses (existing logic)
      console.log('📝 Part 1: Syncing unverified verses...');
      let localCards = await db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => !card.archived)
        .toArray();
        
      // Filter to only sync unverified verses to avoid unnecessary API calls
      const cardsWithUnverifiedVerses = [];
      for (const card of localCards) {
        const verse = await db.verses.get(card.verse_id);
        if (verse && !verse.is_verified) {
          cardsWithUnverifiedVerses.push({ card, verse });
        }
      }

      // Filter by lastSyncTimestamp if provided for incremental sync
      let finalCardsToSync = cardsWithUnverifiedVerses;
      if (lastSyncTimestamp) {
        finalCardsToSync = cardsWithUnverifiedVerses.filter(({ card }) =>
          new Date(card.updated_at) > new Date(lastSyncTimestamp)
        );
      }

      console.log(`📊 Unverified verses to sync: ${finalCardsToSync.length}`);

      // PART 2: Sync all local changes (verse cards, review logs, profile)
      console.log('📝 Part 2: Syncing all local changes...');

      // Get all verse cards that were updated since last sync (including archived ones for sync)
      const changedCards = await db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => {
          if (!lastSyncTimestamp) return true; // First sync - sync all
          return new Date(card.updated_at) > new Date(lastSyncTimestamp);
        })
        .toArray();

      console.log(`📊 Changed verse cards to sync: ${changedCards.length}`);

      // Get review logs that were created since last sync  
      const newReviewLogs = await db.review_logs
        .where('user_id')
        .equals(userId)
        .filter(log => {
          if (!lastSyncTimestamp) return true; // First sync - sync all
          return new Date(log.created_at) > new Date(lastSyncTimestamp);
        })
        .toArray();

      console.log(`📊 New review logs to sync: ${newReviewLogs.length}`);

      // Check if user profile was updated since last sync
      const userProfile = await db.user_profiles.where('user_id').equals(userId).first();
      const profileNeedsSync = userProfile && (!lastSyncTimestamp || 
        new Date(userProfile.updated_at) > new Date(lastSyncTimestamp));

      console.log(`📊 User profile needs sync: ${!!profileNeedsSync}`);

      // Get access token for authenticated operations (skip if anonymous/offline)
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        console.log('⚠️ No access token available - skipping authenticated sync operations');
        return result;
      }

      // Sync changed verse cards to remote
      for (const localCard of changedCards) {
        try {
          const verse = await db.verses.get(localCard.verse_id);
          if (!verse) continue;

          console.log(`🔄 Syncing verse card: ${verse.reference}`);
          await this.updateVerseCardRemote(localCard.id!, localCard, userId, accessToken); 
          result.synced++;
        } catch (error) {
          console.error(`❌ Failed to sync verse card ${localCard.id}:`, error);
          result.failed++;
          result.errors.push(error as Error);
        }
      }

      // Sync new review logs to remote
      for (const localLog of newReviewLogs) {
        try {
          console.log(`🔄 Syncing review log: ${localLog.id}`);
          
          // Find the remote verse card for this review log
          const localCard = await db.verse_cards.get(localLog.verse_card_id);
          if (!localCard) continue;

          const verse = await db.verses.get(localCard.verse_id);
          if (!verse?.id) continue;

          // Find remote card by user_id + verse reference
          const { data: remoteCards } = await supabaseClient
            .from('verse_cards')
            .select('id')
            .eq('user_id', userId)
            .eq('verse_id', verse.id);

          const remoteCard = remoteCards?.[0];
          if (!remoteCard?.id) continue;

          // Check if this review log already exists in remote (prevent duplicates)
          // Use a time window approach: check for similar reviews within ±10 seconds
          const logTime = new Date(localLog.created_at);
          const windowStart = new Date(logTime.getTime() - 10000); // 10 seconds before
          const windowEnd = new Date(logTime.getTime() + 10000);   // 10 seconds after
          
          const { data: existingLogs } = await supabaseClient
            .from('review_logs')
            .select('id, created_at, was_successful')
            .eq('user_id', userId)
            .eq('verse_card_id', remoteCard.id)
            .gte('created_at', windowStart.toISOString())
            .lte('created_at', windowEnd.toISOString())
            .eq('was_successful', localLog.was_successful);

          if (existingLogs && existingLogs.length > 0) {
            console.log(`⏭️ Similar review log already exists remotely (within 10s window), skipping: ${localLog.id}`);
            continue;
          }

          // Create review log in remote database
          const { error: reviewError } = await supabaseClient
            .from('review_logs')
            .insert({
              user_id: userId,
              verse_card_id: remoteCard.id,
              was_successful: localLog.was_successful,
              counted_toward_progress: localLog.counted_toward_progress,
              review_time_seconds: localLog.review_time_seconds,
              created_at: localLog.created_at
            });

          if (reviewError) {
            throw reviewError;
          }

          result.synced++;
        } catch (error) {
          console.error(`❌ Failed to sync review log ${localLog.id}:`, error);
          result.failed++;
          result.errors.push(error as Error);
        }
      }

      // Sync user profile if it was updated
      if (profileNeedsSync && userProfile) {
        try {
          console.log(`🔄 Syncing user profile changes...`);
          await this.updateUserProfile(userId, userProfile, accessToken);
          result.synced++;
        } catch (error) {
          console.error(`❌ Failed to sync user profile:`, error);
          result.failed++;
          result.errors.push(error as Error);
        }
      }

      console.log(`📊 Comprehensive sync summary: 
        - ${finalCardsToSync.length} unverified verses to sync
        - ${changedCards.length} changed verse cards synced
        - ${newReviewLogs.length} review logs synced
        - ${profileNeedsSync ? 1 : 0} profile updates synced`);

      for (const { card: _localCard, verse: localVerse } of finalCardsToSync) {
        try {
          console.log(`🔍 Processing unverified verse: ${localVerse.reference}`);
          
          try {
            // Get access token for edge function call
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session?.access_token) {
              throw new Error('User not authenticated - cannot validate verse remotely');
            }
            
            // Call verse-operations edge function to validate and get correct ESV text
            const verseOperationResult = await secureVerseOperation(
              'create', 
              localVerse.reference, 
              localVerse.reference, 
              session.access_token
            );
            
            if (verseOperationResult.verse) {
              // Update local verse with correct ESV data
              await db.verses.update(localVerse.id!, {
                reference: verseOperationResult.verse.reference, // Use canonical ESV reference
                text: verseOperationResult.verse.text, // Use correct ESV text
                is_verified: true, // Mark as verified
                updated_at: new Date().toISOString()
              });
              
              console.log(`✅ Updated local verse ${localVerse.reference} with ESV data`);
              result.synced++;
              continue; // Skip to next verse, this one is now verified
            } else {
              throw new Error(`Could not validate reference: ${localVerse.reference}`);
            }
            
          } catch (createError) {
            // Handle "already exists" error - this means the verse exists remotely but with different format
            if (createError instanceof Error && createError.message.includes('already exists')) {
              console.log(`📝 Verse already exists remotely, marking local as verified: ${localVerse.reference}`);
              // Mark local verse as verified since it exists remotely
              await db.verses.update(localVerse.id!, {
                is_verified: true,
                validation_error: undefined, // Clear any previous validation error
                updated_at: new Date().toISOString()
              });
              result.synced++;
              continue; // Skip to next verse, this one is now verified
            } 
            // Handle ESV validation errors (invalid references)
            else if (createError instanceof Error && (
              createError.message.includes('not found') ||
              createError.message.includes('does not exist') ||
              createError.message.includes('invalid') ||
              createError.message.includes('No passage found')
            )) {
              console.log(`❌ Invalid verse reference detected: ${localVerse.reference}`);
              // Mark verse with validation error (keeps it out of review but shows in library)
              await db.verses.update(localVerse.id!, {
                validation_error: createError.message,
                updated_at: new Date().toISOString()
              });
              
              // Verify the update worked
              const updatedVerse = await db.verses.get(localVerse.id!);
              console.log(`✅ Verse ${localVerse.reference} marked with validation error:`, {
                id: updatedVerse?.id,
                reference: updatedVerse?.reference,
                validation_error: updatedVerse?.validation_error,
                is_verified: updatedVerse?.is_verified
              });
              
              result.synced++; // Count as "handled" even though it's invalid
              continue;
            } 
            else {
              console.error(`Failed to validate verse ${localVerse.reference}:`, createError);
              result.failed++;
              result.errors.push(new Error(`Failed to validate verse ${localVerse.reference}: ${(createError as Error).message}`));
              continue;
            }
          }

        } catch (error) {
          result.failed++;
          result.errors.push(error as Error);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(error as Error);
      return result;
    }
  },

  /**
   * Syncs remote changes to local database using content-based matching
   * ✅ FIXED: External API calls separate from transaction operations
   */
  async syncFromRemote(userId: string, lastSyncTimestamp?: string): Promise<{
    synced: number;
    failed: number;
    errors: Error[];
  }> {
    const result = {
      synced: 0,
      failed: 0,
      errors: [] as Error[]
    };

    try {
      // Get remote verse cards for the user (filter by timestamp if provided)
      let query = supabaseClient
        .from('verse_cards')
        .select(`
          *,
          verses!inner(*)
        `)
        .eq('user_id', userId);

      // Filter by lastSyncTimestamp if provided for incremental sync
      if (lastSyncTimestamp) {
        query = query.gt('updated_at', lastSyncTimestamp);
      }

      const { data: remoteCards, error: cardsError } = await query;

      if (cardsError) {
        throw cardsError;
      }

      for (const remoteCard of remoteCards || []) {
        try {
          const remoteVerse = remoteCard.verses;

          // Step 1: Ensure the verse exists locally (outside transaction)
          let localVerse = await db.verses
            .where('[reference+translation]')
            .equals([remoteVerse.reference, remoteVerse.translation])
            .first();

          if (!localVerse) {
            // Create verse locally using transaction
            await db.transaction('rw', db.verses, async (tx) => {
              const now = new Date().toISOString();
              const verseData: LocalDBSchema['verses'] = {
                id: remoteVerse.id,
                reference: remoteVerse.reference,
                text: remoteVerse.text,
                translation: remoteVerse.translation,
                is_verified: true, // Remote verses are always ESV-verified
                created_at: now,
                updated_at: now
              };
              await tx.verses.add(verseData);
              localVerse = verseData;
            });
          }

          // Step 2: Check if verse card exists locally
          const localCard = await db.verse_cards
            .where('[user_id+verse_id]')
            .equals([userId, localVerse!.id!])
            .first();

          if (!localCard) {
            // Create verse card locally using transaction
            await db.transaction('rw', db.verse_cards, async (tx) => {
              const now = new Date().toISOString();
              const cardData: LocalDBSchema['verse_cards'] = {
                id: crypto.randomUUID(),
                user_id: remoteCard.user_id,
                verse_id: localVerse!.id!,
                current_phase: remoteCard.current_phase as 'daily' | 'weekly' | 'biweekly' | 'monthly',
                phase_progress_count: remoteCard.phase_progress_count,
                last_reviewed_at: remoteCard.last_reviewed_at,
                next_due_date: remoteCard.next_due_date,
                assigned_day_of_week: remoteCard.assigned_day_of_week,
                assigned_week_parity: remoteCard.assigned_week_parity,
                assigned_day_of_month: remoteCard.assigned_day_of_month,
                archived: remoteCard.archived,
                current_streak: remoteCard.current_streak,
                best_streak: remoteCard.best_streak || 0,
                created_at: now,
                updated_at: now
              };
              await tx.verse_cards.add(cardData);
            });
            result.synced++;
          } else {
            // Smart merge strategy to prevent data loss
            const localUpdated = new Date(localCard.updated_at);
            const remoteUpdated = new Date(remoteCard.updated_at || localCard.updated_at);
            
            console.log(`🔄 Conflict resolution for verse ${remoteVerse.reference}:`, {
              localUpdated: localUpdated.toISOString(),
              remoteUpdated: remoteUpdated.toISOString(),
              timeDiff: remoteUpdated.getTime() - localUpdated.getTime()
            });

            // Always perform smart merge, even if timestamps are equal
            const needsUpdate = await this.smartMergeVerseCard(localCard, remoteCard);
            
            if (needsUpdate.hasChanges) {
              await db.transaction('rw', db.verse_cards, async (tx) => {
                await tx.verse_cards.update(localCard.id!, needsUpdate.mergedData);
              });
              result.synced++;
              
              if (needsUpdate.conflicts.length > 0) {
                console.warn(`⚠️ Conflicts resolved for ${remoteVerse.reference}:`, needsUpdate.conflicts);
              }
            }
          }
        } catch (error) {
          result.failed++;
          result.errors.push(error as Error);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(error as Error);
      return result;
    }
  },

  /**
   * Performs incremental sync between local and remote databases
   * Only syncs records that have changed since the last sync timestamp
   */
  async sync(userId: string, lastSyncTimestamp?: string): Promise<{
    toRemote: { synced: number; failed: number; errors: Error[] };
    fromRemote: { synced: number; failed: number; errors: Error[] };
    lastSyncTimestamp: string;
  }> {
    const syncTimestamp = new Date().toISOString();

    // Use lastSyncTimestamp to only fetch changed records
    const toRemote = await this.syncToRemote(userId, lastSyncTimestamp);
    const fromRemote = await this.syncFromRemote(userId, lastSyncTimestamp);

    return { toRemote, fromRemote, lastSyncTimestamp: syncTimestamp };
  },

  /**
   * Gets all verses for a user from both local and remote with merge strategy
   */
  async getUserVerses(userId: string): Promise<Array<{
    verse: LocalDBSchema['verses'];
    verseCard: LocalDBSchema['verse_cards'];
    source: 'local' | 'remote' | 'both';
  }>> {
    const results: Array<{
      verse: LocalDBSchema['verses'];
      verseCard: LocalDBSchema['verse_cards'];
      source: 'local' | 'remote' | 'both';
    }> = [];

    // Get local verses (no transaction needed for read operations)
    const localCards = await db.verse_cards
      .where('user_id')
      .equals(userId)
      .filter(card => !card.archived)
      .toArray();

    for (const card of localCards) {
      // Get verse data
      const verse = await db.verses.get(card.verse_id);
      if (verse) {
        results.push({
          verse,
          verseCard: card,
          source: 'local'
        });
      }
    }

    // TODO: Merge with remote data (for now, just return local)
    // This would involve fetching from Supabase and merging based on timestamps
    return results;
  },

  /**
   * Syncs user profile from remote to local database
   */
  async syncUserProfile(userId: string): Promise<void> {
    console.log('🔄 Starting user profile sync for user:', userId.slice(0, 8) + '...');
    
    try {
      // Get user profile from remote
      console.log('🔄 Fetching remote user profile...');
      const { data: remoteProfile, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn('❌ No remote user profile found:', error.message);
        return;
      }

      console.log('✅ Remote profile found:', {
        email: remoteProfile.email || '(empty)',
        // pending_email is local-only field for email verification state
        full_name: remoteProfile.full_name || '(empty)'
      });

      if (remoteProfile) {
        // Check if profile exists locally
        const existingProfile = await db.user_profiles
          .where('user_id')
          .equals(userId)
          .first();

        console.log('📍 Local profile before update:', existingProfile ? {
          email: existingProfile.email || '(empty)',
          pending_email: existingProfile.pending_email_verification || '(none)',
          full_name: existingProfile.full_name || '(empty)'
        } : 'None found');

        const profileData: LocalDBSchema['user_profiles'] = {
          id: remoteProfile.id,
          user_id: remoteProfile.user_id,
          email: remoteProfile.email || '',
          full_name: remoteProfile.full_name || '',
          timezone: remoteProfile.timezone || 'UTC',
          preferred_translation: remoteProfile.preferred_translation || 'ESV',
          reference_display_mode: remoteProfile.reference_display_mode || 'first',
          pending_email_verification: null, // Local-only field
          email_verification_sent_at: null, // Local-only field
          created_at: remoteProfile.created_at || new Date().toISOString(),
          updated_at: remoteProfile.updated_at || new Date().toISOString()
        };

        if (existingProfile) {
          // Update existing profile
          await db.user_profiles.update(existingProfile.id!, profileData);
          console.log('✅ Updated local user profile with new data:', {
            email: profileData.email || '(empty)',
            pending_email: profileData.pending_email_verification || '(none)',
            full_name: profileData.full_name || '(empty)'
          });
        } else {
          // Create new profile
          await db.user_profiles.add(profileData);
          console.log('✅ Created local user profile');
        }
      }
    } catch (error) {
      console.error('❌ Failed to sync user profile:', error);
    }
  },

  /**
   * Archives a verse card (soft delete) with dual-write strategy
   */
  async archiveVerse(
    verseCardId: string,
    userId: string
  ): Promise<DualWriteResult<LocalDBSchema['verse_cards']>> {
    const result: DualWriteResult<LocalDBSchema['verse_cards']> = {
      local: null,
      remote: null,
      errors: {},
      success: false
    };

    try {
      // Step 1: Archive verse card locally in transaction
      let archivedCard: LocalDBSchema['verse_cards'];
      
      await db.transaction('rw', db.verse_cards, async (tx) => {
        const card = await tx.verse_cards.get(verseCardId);
        if (!card) {
          throw new Error('Verse card not found');
        }

        if (card.user_id !== userId) {
          throw new Error('Unauthorized: cannot archive another user\'s verse');
        }

        const now = new Date().toISOString();
        const updateData = {
          archived: true,
          updated_at: now
        };

        await tx.verse_cards.update(verseCardId, updateData);
        archivedCard = { ...card, ...updateData };
      });

      result.local = archivedCard!;

      // Step 2: Sync to remote (graceful degradation on failure) - OUTSIDE transaction
      try {
        // Get local references for remote sync
        const localCard = await db.verse_cards.get(verseCardId);
        if (localCard) {
          const localVerse = await db.verses.get(localCard.verse_id);
          if (localVerse) {
            // Find remote verse by reference+translation
            const { data: remoteVerses, error: verseSelectError } = await supabaseClient
              .from('verses')
              .select('id')
              .eq('reference', localVerse.reference)
              .eq('translation', localVerse.translation);

            if (verseSelectError) {
              throw verseSelectError;
            }

            if (remoteVerses && remoteVerses.length > 0) {
              const remoteVerse = remoteVerses[0];
              // Find remote card by user_id + verse_id
              const { data: remoteCards, error: cardSelectError } = await supabaseClient
                .from('verse_cards')
                .select('id')
                .eq('user_id', userId)
                .eq('verse_id', remoteVerse.id);

              if (cardSelectError) {
                throw cardSelectError;
              }

              const remoteCard = remoteCards && remoteCards.length > 0 ? remoteCards[0] : null;

              if (remoteCard) {
                // Archive card remotely
                const { error: archiveError } = await supabaseClient
                  .from('verse_cards')
                  .update({ 
                    archived: true,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', remoteCard.id);

                if (archiveError) {
                  throw archiveError;
                }
                console.log('Verse archived in remote database successfully');
              }
            }
          }
        }
        result.remote = null; // We don't return the remote card object
      } catch (error) {
        result.errors.remote = new NetworkError(
          'Failed to sync archive to remote database - verse archived locally',
          error as Error
        );
        // Don't throw here - local operation succeeded
      }

      result.success = true;
      return result;

    } catch (error) {
      result.errors.local = error as Error;
      throw new Error(`Failed to archive verse: ${(error as Error).message}`);
    }
  },

  /**
   * Intelligent sync that decides between individual and batch operations
   * Based on queue size and network quality
   */
  async intelligentSync(
    userId: string, 
    lastSyncTimestamp?: string
  ): Promise<BatchDualWriteResult | ReturnType<typeof dataService.sync>> {
    try {
      // Import BatchSyncService dynamically to avoid circular imports
      const { BatchSyncService, shouldUseBatchSync } = await import('./batchSyncService');
      
      // Check current queue status
      const queueStatus = BatchSyncService.getQueueStatus();
      const userOperations = queueStatus.operations.filter(op => op.userId === userId);
      
      console.log(`🧠 Intelligent sync: ${userOperations.length} queued operations for user`);
      
      // Decide whether to use batch or individual sync
      const useBatch = await shouldUseBatchSync(userOperations.length);
      
      if (useBatch && userOperations.length > 0) {
        try {
          console.log(`🚀 Using batch sync for ${userOperations.length} operations`);
          const batchResult = await BatchSyncService.processBatchQueue();
          
          // Also run individual sync to catch any non-queued changes
          if (lastSyncTimestamp) {
            const individualResult = await this.sync(userId, lastSyncTimestamp);
            console.log(`📊 Individual sync completed: ${individualResult.toRemote.synced + individualResult.fromRemote.synced} records`);
          }
          
          return batchResult;
        } catch (error) {
          console.warn('Batch sync failed, falling back to individual sync:', error);
          return await this.sync(userId, lastSyncTimestamp);
        }
      } else {
        console.log(`📱 Using individual sync (queue size: ${userOperations.length})`);
        return await this.sync(userId, lastSyncTimestamp);
      }
    } catch (error) {
      console.warn('BatchSyncService not available, using individual sync:', error);
      return await this.sync(userId, lastSyncTimestamp);
    }
  },

  /**
   * Queues an operation for batch processing instead of immediate sync
   */
  async queueSyncOperation(
    type: QueuedSyncOperation['type'],
    data: any,
    localRef: string,
    userId: string
  ): Promise<void> {
    try {
      const { BatchSyncService } = await import('./batchSyncService');
      return await BatchSyncService.queueOperation(type, data, localRef, userId);
    } catch (error) {
      console.warn('BatchSyncService not available, skipping queue operation:', error);
    }
  },

  /**
   * Forces immediate processing of the sync queue
   */
  async flushSyncQueue(): Promise<BatchDualWriteResult> {
    try {
      const { BatchSyncService } = await import('./batchSyncService');
      return await BatchSyncService.flushQueue();
    } catch (error) {
      console.warn('BatchSyncService not available, returning empty result:', error);
      return {
        batchId: crypto.randomUUID(),
        operations: [],
        summary: { total: 0, successful: 0, failed: 0, networkErrors: 0, validationErrors: 0 },
        processingTimeMs: 0
      };
    }
  },

  /**
   * Gets the current sync queue status for debugging/monitoring
   */
  getSyncQueueStatus() {
    try {
      const { BatchSyncService } = require('./batchSyncService');
      return BatchSyncService.getQueueStatus();
    } catch (error) {
      console.warn('BatchSyncService not available:', error);
      return { pending: 0, processing: 0, failed: 0, operations: [] };
    }
  },

  /**
   * Updates user profile with dual-write pattern
   */
  async updateUserProfile(
    userId: string,
    updates: Partial<LocalDBSchema['user_profiles']>,
    accessToken?: string
  ): Promise<DualWriteResult<LocalDBSchema['user_profiles']>> {
    const result: DualWriteResult<LocalDBSchema['user_profiles']> = {
      local: null,
      remote: null,
      errors: {},
      success: false
    };

    try {
      // Step 1: Update locally first (optimistic UI)
      let updatedProfile: LocalDBSchema['user_profiles'];
      
      await db.transaction('rw', db.user_profiles, async (tx) => {
        const existing = await tx.user_profiles.where('user_id').equals(userId).first();
        if (!existing) {
          throw new Error('User profile not found');
        }

        const updateData = {
          ...updates,
          updated_at: new Date().toISOString()
        };

        await tx.user_profiles.update(existing.id!, updateData);
        updatedProfile = { ...existing, ...updateData };
      });

      result.local = updatedProfile!;

      // Step 2: Sync to remote (graceful degradation)
      if (accessToken) {
        try {
          // Filter out local-only fields from remote sync
          const { pending_email_verification, email_verification_sent_at, ...remoteUpdates } = updates;
          
          const { data: remoteProfile, error: remoteError } = await supabaseClient
            .from('user_profiles')
            .upsert({
              user_id: userId,
              ...remoteUpdates,
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (remoteError) throw remoteError;
          result.remote = remoteProfile as any;
        } catch (error) {
          result.errors.remote = new NetworkError(
            'Failed to sync profile to remote - changes saved locally',
            error as Error
          );
        }
      }

      result.success = true;
      return result;
    } catch (error) {
      result.errors.local = error as Error;
      throw error;
    }
  },

  /**
   * Lookup a verse reference using ESV API (for VerseDetails page)
   * Returns verse data without adding to user's collection
   */
  async lookupVerseReference(reference: string): Promise<{ success: boolean; verse?: LocalDBSchema['verses'] }> {
    try {
      const supabaseUrl = process.env.NODE_ENV === 'test' 
        ? process.env.VITE_SUPABASE_URL 
        : import.meta.env.VITE_SUPABASE_URL;
      
      // Get access token for authenticated call
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        throw new Error('User not authenticated');
      }

      // Call verse-operations edge function for ESV lookup only
      const response = await fetch(`${supabaseUrl}/functions/v1/verse-operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          operation: 'lookup', // Use existing operation type
          reference,
          normalizedRef: reference,
          translation: 'ESV'
        })
      });

      if (!response.ok) {
        throw new Error(`ESV lookup failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.verse) {
        // Cache the verse locally for future use
        const now = new Date().toISOString();
        const localVerseData: LocalDBSchema['verses'] = {
          id: crypto.randomUUID(),
          reference: result.verse.reference,
          text: result.verse.text,
          translation: 'ESV',
          is_verified: true,
          created_at: now,
          updated_at: now
        };
        await db.verses.add(localVerseData);
        
        const localVerse = localVerseData;

        return { success: true, verse: localVerse };
      }

      return { success: false };
    } catch (error) {
      console.error('ESV lookup error:', error);
      return { success: false };
    }
  },

  /**
   * Manual phase change with smart assignment recalculation
   * Handles phase progression with automatic due date and assignment updates
   */
  async changeVersePhase(
    verseCardId: string, 
    newPhase: 'daily' | 'weekly' | 'biweekly' | 'monthly',
    userId: string,
    accessToken?: string
  ): Promise<DualWriteResult<LocalDBSchema['verse_cards']>> {

    const result: DualWriteResult<LocalDBSchema['verse_cards']> = {
      success: false,
      local: null,
      remote: null,
      errors: {}
    };

    try {
      let updatedCard: LocalDBSchema['verse_cards'] | undefined;
      
      // Get user profile for timezone BEFORE transaction
      const userProfile = await db.user_profiles.where('user_id').equals(userId).first();
      const userTimezone = userProfile?.timezone || 'UTC';

      // Calculate smart assignment BEFORE transaction (if needed)
      const assignment = newPhase === 'daily' 
        ? { day_of_week: null, week_parity: null, day_of_month: null }
        : await this.calculateSmartAssignment(userId, newPhase);
      
      const nextDueDate = this.calculateNextDueDate(newPhase, assignment, userTimezone);
      
      // Step 1: Update locally with smart assignment
      await db.transaction('rw', [db.verse_cards], async (tx) => {
        const existingCard = await tx.verse_cards.get(verseCardId);
        if (!existingCard) {
          throw new Error(`Verse card not found: ${verseCardId}`);
        }

        const updateData = {
          current_phase: newPhase,
          phase_progress_count: 0, // Reset progress for new phase
          next_due_date: nextDueDate,
          assigned_day_of_week: assignment.day_of_week,
          assigned_week_parity: assignment.week_parity,  
          assigned_day_of_month: assignment.day_of_month,
          updated_at: new Date().toISOString()
        };

        await tx.verse_cards.update(verseCardId, updateData);
        updatedCard = { ...existingCard, ...updateData };
      });

      result.local = updatedCard!;

      // Step 2: Sync to cloud (graceful degradation)
      if (accessToken) {
        try {
          console.log('🔄 Syncing phase change to remote...');
          
          // Find remote card by user_id + verse_id (since local and remote IDs differ)
          const { data: remoteCards, error: findError } = await supabaseClient
            .from('verse_cards')
            .select('id')
            .eq('user_id', userId)
            .eq('verse_id', updatedCard!.verse_id);

          if (findError) throw findError;

          if (!remoteCards || remoteCards.length === 0) {
            console.warn('⚠️ No remote verse card found for phase change');
            return result;
          }

          const remoteCardId = remoteCards[0].id;
          console.log('🔍 Found remote card for phase update:', remoteCardId);

          // Update the remote card
          const { data: remoteCard, error: remoteError } = await supabaseClient
            .from('verse_cards')
            .update({
              current_phase: updatedCard!.current_phase,
              phase_progress_count: updatedCard!.phase_progress_count,
              next_due_date: updatedCard!.next_due_date,
              assigned_day_of_week: updatedCard!.assigned_day_of_week,
              assigned_week_parity: updatedCard!.assigned_week_parity,
              assigned_day_of_month: updatedCard!.assigned_day_of_month,
              updated_at: updatedCard!.updated_at
            })
            .eq('id', remoteCardId)
            .eq('user_id', userId) // Double-check RLS
            .select()
            .single();

          if (remoteError) throw remoteError;
          
          console.log('✅ Phase change synced to remote successfully');
          result.remote = remoteCard as LocalDBSchema['verse_cards'];
        } catch (error) {
          console.error('❌ Failed to sync phase change to remote:', error);
          result.errors.remote = new NetworkError(
            'Failed to sync phase change to remote - changes saved locally',
            error as Error
          );
        }
      }

      result.success = true;
      return result;
    } catch (error) {
      result.errors.local = error as Error;
      throw error;
    }
  },

  /**
   * Calculate smart assignment for a user's new phase
   * Replicates database logic locally for immediate UI updates
   */
  async calculateSmartAssignment(userId: string, phase: 'weekly' | 'biweekly' | 'monthly'): Promise<{
    day_of_week: number | null;
    week_parity: number | null;
    day_of_month: number | null;
  }> {
    if (phase === 'weekly') {
      // Find weekday with fewest weekly cards
      const weekdayCount = new Map<number, number>();
      for (let day = 1; day <= 7; day++) {
        weekdayCount.set(day, 0);
      }

      const weeklyCards = await db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => !card.archived && card.current_phase === 'weekly')
        .toArray();

      weeklyCards.forEach(card => {
        if (card.assigned_day_of_week) {
          const count = weekdayCount.get(card.assigned_day_of_week) || 0;
          weekdayCount.set(card.assigned_day_of_week, count + 1);
        }
      });

      const optimalDay = Array.from(weekdayCount.entries())
        .sort((a, b) => a[1] - b[1])[0][0];

      return { day_of_week: optimalDay, week_parity: null, day_of_month: null };

    } else if (phase === 'biweekly') {
      // Find weekday+parity combo with fewest biweekly cards
      const comboCount = new Map<string, number>();
      for (let day = 1; day <= 7; day++) {
        for (let parity = 0; parity <= 1; parity++) {
          comboCount.set(`${day}-${parity}`, 0);
        }
      }

      const biweeklyCards = await db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => !card.archived && card.current_phase === 'biweekly')
        .toArray();

      biweeklyCards.forEach(card => {
        if (card.assigned_day_of_week !== null && card.assigned_week_parity !== null) {
          const key = `${card.assigned_day_of_week}-${card.assigned_week_parity}`;
          const count = comboCount.get(key) || 0;
          comboCount.set(key, count + 1);
        }
      });

      const optimalCombo = Array.from(comboCount.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      const [dayStr, parityStr] = optimalCombo.split('-');

      return { 
        day_of_week: parseInt(dayStr), 
        week_parity: parseInt(parityStr), 
        day_of_month: null 
      };

    } else if (phase === 'monthly') {
      // Find day of month with fewest monthly cards
      const dayCount = new Map<number, number>();
      for (let day = 1; day <= 28; day++) {
        dayCount.set(day, 0);
      }

      const monthlyCards = await db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => !card.archived && card.current_phase === 'monthly')
        .toArray();

      monthlyCards.forEach(card => {
        if (card.assigned_day_of_month) {
          const count = dayCount.get(card.assigned_day_of_month) || 0;
          dayCount.set(card.assigned_day_of_month, count + 1);
        }
      });

      const optimalDay = Array.from(dayCount.entries())
        .sort((a, b) => a[1] - b[1])[0][0];

      return { day_of_week: null, week_parity: null, day_of_month: optimalDay };
    }

    return { day_of_week: null, week_parity: null, day_of_month: null };
  },

  /**
   * Calculate next due date based on phase and assignment
   * Replicates database logic locally for immediate UI updates
   */
  calculateNextDueDate(
    phase: 'daily' | 'weekly' | 'biweekly' | 'monthly',
    assignment: { day_of_week: number | null; week_parity: number | null; day_of_month: number | null },
    _userTimezone: string = 'UTC'
  ): string {
    const today = new Date();
    
    if (phase === 'daily') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    if (phase === 'weekly' && assignment.day_of_week) {
      const currentDow = today.getDay() || 7; // Convert Sunday=0 to Sunday=7
      const targetDow = assignment.day_of_week;
      let daysAhead = (targetDow - currentDow + 7) % 7;
      if (daysAhead === 0) daysAhead = 7; // If today, schedule for next week
      
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + daysAhead);
      return nextDate.toISOString().split('T')[0];
    }

    if (phase === 'biweekly' && assignment.day_of_week && assignment.week_parity !== null) {
      let nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + 1);
      
      // Find next occurrence of weekday + week parity
      for (let i = 0; i < 14; i++) {
        const dow = nextDate.getDay() || 7;
        const weeksSinceEpoch = Math.floor(nextDate.getTime() / (1000 * 60 * 60 * 24 * 7));
        const weekParity = weeksSinceEpoch % 2;
        
        if (dow === assignment.day_of_week && weekParity === assignment.week_parity) {
          return nextDate.toISOString().split('T')[0];
        }
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }

    if (phase === 'monthly' && assignment.day_of_month) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth(), assignment.day_of_month);
      if (nextMonth <= today) {
        nextMonth.setMonth(nextMonth.getMonth() + 1);
      }
      return nextMonth.toISOString().split('T')[0];
    }

    // Fallback
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  },

  /**
   * Updates a verse card remotely (for syncing local changes to cloud)
   */
  async updateVerseCardRemote(
    cardId: string, 
    updates: Partial<LocalDBSchema['verse_cards']>, 
    userId: string, 
    _accessToken: string
  ): Promise<void> {
    console.log('🔄 Updating verse card remotely:', {
      cardId: cardId.slice(0, 8) + '...',
      updates,
      userId: userId.slice(0, 8) + '...'
    });

    try {
      // Find the remote card by local card reference (we need to match by user_id + verse_id)
      const localCard = await db.verse_cards.get(cardId);
      if (!localCard) {
        throw new Error('Local verse card not found');
      }

      // Find remote card by user_id + verse_id
      const { data: remoteCards, error: findError } = await supabaseClient
        .from('verse_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('verse_id', localCard.verse_id);

      if (findError) {
        throw findError;
      }

      if (!remoteCards || remoteCards.length === 0) {
        console.warn('⚠️ No remote verse card found to update');
        return;
      }

      const remoteCardId = remoteCards[0].id;
      console.log('🔍 Found remote card to update:', remoteCardId);

      // Update remote card using supabase helper
      const { error: updateError } = await supabaseDb.verseCards.update(remoteCardId, {
        ...updates,
        updated_at: new Date().toISOString()
      }, userId);

      if (updateError) {
        throw updateError;
      }

      console.log('✅ Remote verse card updated successfully');
    } catch (error) {
      console.error('❌ Failed to update verse card remotely:', error);
      throw error;
    }
  },

  /**
   * Completes email verification by updating user profile
   * Called after successful email verification from AuthContext
   */
  /**
   * Smart merge strategy for verse cards to prevent data loss
   * Uses field-specific logic to resolve conflicts intelligently
   */
  async smartMergeVerseCard(
    localCard: LocalDBSchema['verse_cards'], 
    remoteCard: any
  ): Promise<{
    hasChanges: boolean;
    mergedData: Partial<LocalDBSchema['verse_cards']>;
    conflicts: string[];
  }> {
    const conflicts: string[] = [];
    const mergedData: Partial<LocalDBSchema['verse_cards']> = {};
    let hasChanges = false;

    const localUpdated = new Date(localCard.updated_at);
    const remoteUpdated = new Date(remoteCard.updated_at || localCard.updated_at);

    // RULE 1: Best Streak - Always take the higher value (user achievement protection)
    const localBestStreak = localCard.best_streak || 0;
    const remoteBestStreak = remoteCard.best_streak || 0;
    if (localBestStreak !== remoteBestStreak) {
      const maxStreak = Math.max(localBestStreak, remoteBestStreak);
      mergedData.best_streak = maxStreak;
      hasChanges = true;
      
      if (maxStreak !== remoteBestStreak) {
        conflicts.push(`best_streak: kept local ${localBestStreak} over remote ${remoteBestStreak}`);
      }
    }

    // RULE 2: Current Streak - Take the more recent one, but validate against review logs
    if (localCard.current_streak !== remoteCard.current_streak) {
      if (remoteUpdated > localUpdated) {
        mergedData.current_streak = remoteCard.current_streak;
        hasChanges = true;
        conflicts.push(`current_streak: used remote ${remoteCard.current_streak} over local ${localCard.current_streak} (newer)`);
      }
      // Keep local if it's newer (already handled by not updating)
    }

    // RULE 3: Phase Progression - Take the more advanced phase or more recent change
    const phaseOrder = { 'daily': 0, 'weekly': 1, 'biweekly': 2, 'monthly': 3 };
    const localPhaseLevel = phaseOrder[localCard.current_phase];
    const remotePhaseLevel = phaseOrder[remoteCard.current_phase as keyof typeof phaseOrder];
    
    if (localCard.current_phase !== remoteCard.current_phase) {
      // If phases are different, use more advanced phase unless remote is much newer
      const timeDiffHours = (remoteUpdated.getTime() - localUpdated.getTime()) / (1000 * 60 * 60);
      
      if (remotePhaseLevel > localPhaseLevel || (remotePhaseLevel >= localPhaseLevel && timeDiffHours > 1)) {
        mergedData.current_phase = remoteCard.current_phase;
        mergedData.phase_progress_count = remoteCard.phase_progress_count;
        hasChanges = true;
        conflicts.push(`phase: used remote ${remoteCard.current_phase} over local ${localCard.current_phase}`);
      }
    }

    // RULE 4: Review Timestamps - Take the most recent review
    const localLastReview = localCard.last_reviewed_at ? new Date(localCard.last_reviewed_at) : null;
    const remoteLastReview = remoteCard.last_reviewed_at ? new Date(remoteCard.last_reviewed_at) : null;
    
    if (localLastReview && remoteLastReview) {
      if (remoteLastReview > localLastReview) {
        mergedData.last_reviewed_at = remoteCard.last_reviewed_at;
        hasChanges = true;
      }
    } else if (remoteLastReview && !localLastReview) {
      mergedData.last_reviewed_at = remoteCard.last_reviewed_at;
      hasChanges = true;
    }

    // RULE 5: Due Dates - Use the earlier due date (more conservative approach)
    if (localCard.next_due_date !== remoteCard.next_due_date) {
      const localDue = new Date(localCard.next_due_date);
      const remoteDue = new Date(remoteCard.next_due_date);
      
      if (remoteDue < localDue) {
        mergedData.next_due_date = remoteCard.next_due_date;
        hasChanges = true;
        conflicts.push(`next_due_date: used earlier remote date ${remoteCard.next_due_date} over local ${localCard.next_due_date}`);
      }
    }

    // RULE 6: Assignments - Prefer remote if it's newer by significant margin
    const timeDiffHours = (remoteUpdated.getTime() - localUpdated.getTime()) / (1000 * 60 * 60);
    if (timeDiffHours > 1) { // More than 1 hour difference
      if (localCard.assigned_day_of_week !== remoteCard.assigned_day_of_week) {
        mergedData.assigned_day_of_week = remoteCard.assigned_day_of_week;
        hasChanges = true;
      }
      if (localCard.assigned_week_parity !== remoteCard.assigned_week_parity) {
        mergedData.assigned_week_parity = remoteCard.assigned_week_parity;
        hasChanges = true;
      }
      if (localCard.assigned_day_of_month !== remoteCard.assigned_day_of_month) {
        mergedData.assigned_day_of_month = remoteCard.assigned_day_of_month;
        hasChanges = true;
      }
    }

    // RULE 7: Archive Status - Take the most recent
    if (localCard.archived !== remoteCard.archived) {
      if (remoteUpdated > localUpdated) {
        mergedData.archived = remoteCard.archived;
        hasChanges = true;
        conflicts.push(`archived: used remote ${remoteCard.archived} over local ${localCard.archived} (newer)`);
      }
    }

    // Always update timestamp to the latest
    if (hasChanges) {
      mergedData.updated_at = new Date().toISOString();
    }

    return { hasChanges, mergedData, conflicts };
  },

  /**
   * Ensures a user profile exists both locally and remotely
   * Creates the profile with default values if it doesn't exist
   */
  async ensureUserProfile(userId: string, userData?: {
    email?: string | null;
    full_name?: string | null;
    timezone?: string;
  }): Promise<void> {
    console.log('🔄 Ensuring user profile exists for user:', userId.slice(0, 8) + '...');
    
    try {
      // Get current user from Supabase to extract metadata
      const { data: { user } } = await supabaseClient.auth.getUser();
      const userEmail = userData?.email || user?.email || null;
      const userFullName = userData?.full_name || user?.user_metadata?.full_name || (userEmail ? userEmail.split('@')[0] : null);
      const userTimezone = userData?.timezone || user?.user_metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Create/update profile using UPSERT logic
      await this.updateUserProfile(userId, {
        email: userEmail,
        full_name: userFullName,
        timezone: userTimezone,
        preferred_translation: 'ESV',
        reference_display_mode: 'full'
      });
      
      console.log('✅ User profile ensured successfully');
    } catch (error) {
      console.error('❌ Failed to ensure user profile:', error);
      throw error;
    }
  },

  async completeEmailVerification(userId: string, email: string): Promise<void> {
    console.log('🔄 Starting email verification completion:', {
      userId: userId.slice(0, 8) + '...',
      email: email
    });

    try {
      // Step 1: Update user profile in remote database to clear pending verification
      console.log('🔄 Clearing pending email verification status remotely...');
      const { error: remoteError } = await supabaseClient
        .from('user_profiles')
        .update({
          email: email,
          pending_email_verification: null,
          email_verification_sent_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (remoteError) {
        console.error('❌ Failed to update remote profile after email verification:', remoteError);
        throw remoteError;
      }

      console.log('✅ Remote profile updated after email verification');

      // Step 2: Sync the updated profile back to local database
      console.log('🔄 Syncing updated profile to local database...');
      await this.syncUserProfile(userId);
      
      console.log('✅ Email verification completion successful');
    } catch (error) {
      console.error('❌ Failed to complete email verification:', error);
      throw error;
    }
  }
};

export default dataService;