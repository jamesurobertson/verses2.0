import { db, type LocalDBSchema } from './localDb';
import { supabaseClient, db as supabaseDb } from './supabase';
import { normalizeReferenceForLookup } from '../utils/referenceNormalizer';
import { getTodayString } from '../utils/dateUtils';
import { BatchSyncService, shouldUseBatchSync } from './batchSyncService';

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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
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
    
    console.log('🚀 Sending request to verse-operations:', {
      operation,
      reference,
      hasToken: !!token
    });
    
    // Add timeout for better performance
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
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
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verse operation failed');
      }
      
      const data = await response.json();
      return {
        verse: data.verse,
        foundViaAlias: data.foundViaAlias,
        existingCard: data.userCard,
        source: data.source
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('Edge function call error:', error);
      
      if (error instanceof Error && (
        error.name === 'AbortError' || 
        error.message.includes('aborted') ||
        error.message.includes('cancelled')
      )) {
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
        throw new NetworkError('Unable to connect to server. Please check your internet connection.', error);
      }
      throw error;
    }
  } catch (error) {
    console.error('Secure verse operation error:', error);
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
export const dataService = {
  /**
   * Adds a new verse with local-first approach:
   * 1. Check local database (verses + aliases table)
   * 2. If authenticated: Check remote database via edge functions
   * 3. If local-only: Create verse manually (user provides text)
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
    const nextDueDate = getTodayString();

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
          await tx.verse_cards.add(cardData);
          result.local = { verse: localVerse!, verseCard: cardData };
        });

        // Sync to remote (outside transaction)
        await this.syncVerseToRemote(result.local!.verse, result.local!.verseCard, result, accessToken);
        result.success = true;
        return result;
      }

      // STEP 2: Handle remote operations (authenticated/anonymous modes only)
      if (accessToken) {
        try {
          const { verse: foundRemoteVerse, existingCard } = await cachedVerseOperation('create', reference, normalizedInput, accessToken);

          if (foundRemoteVerse) {
            // We already have the user's card info from the optimized lookup
            if (existingCard) {
              if (existingCard.archived) {
                // Handle archived card unarchiving
                throw new DuplicateVerseError(foundRemoteVerse.reference, {
                  verse: foundRemoteVerse,
                  verseCard: existingCard
                });
              } else {
                // Active card exists
                throw new DuplicateVerseError(foundRemoteVerse.reference, {
                  verse: foundRemoteVerse,
                  verseCard: existingCard
                });
              }
            }

            // No existing card for user - sync remote to local and create verse_card
            await this.syncRemoteVerseToLocal(foundRemoteVerse, normalizedInput, userId, nextDueDate, result);
            result.success = true;
            return result;
          }
        } catch (error) {
          // Re-throw network errors so the UI can handle them (switch to manual entry mode)
          if (error instanceof NetworkError) {
            throw error;
          }
          // Continue to local-only creation below for other errors
        }
      }

      // STEP 3: Local-only verse creation (no ESV API access)
      if (!manualText || manualText.trim() === '') {
        throw new ValidationError('Verse text is required for local-only mode. Please provide the verse text manually.');
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
        constructor: error.constructor.name
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

  // Helper methods for addVerse
  async syncVerseToRemote(verse: LocalDBSchema['verses'], verseCard: LocalDBSchema['verse_cards'], result: any, accessToken?: string) {
    // Skip remote sync if no access token (local-only mode)
    if (!accessToken) {
      console.log('Skipping remote sync - local-only mode');
      return;
    }

    try {
      // Verse creation is now handled by secure edge functions
      // Just create the verse card since verse should already exist remotely
      const { error: cardError } = await supabaseDb.verseCards.create({
        user_id: verseCard.user_id,
        verse_id: verse.id!, // Use local verse ID - should match remote due to edge function
        current_phase: verseCard.current_phase,
        phase_progress_count: verseCard.phase_progress_count,
        last_reviewed_at: verseCard.last_reviewed_at,
        next_due_date: verseCard.next_due_date,
        assigned_day_of_week: verseCard.assigned_day_of_week,
        assigned_week_parity: verseCard.assigned_week_parity,
        assigned_day_of_month: verseCard.assigned_day_of_month,
        archived: verseCard.archived,
        current_streak: verseCard.current_streak,
        best_streak: verseCard.best_streak
      });

      if (cardError) throw cardError;
    } catch (err) {
      result.errors.remote = new NetworkError(
        'Failed to sync to remote database - data saved locally',
        err as Error
      );
    }
  },

  async syncRemoteVerseToLocal(remoteVerse: any, alias: string, userId: string, nextDueDate: string, result: any) {
    // Create verse locally in transaction
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
      await tx.verse_cards.add(cardData);

      result.local = { verse: localVerseData, verseCard: cardData };
    });
  },

  async addAliasAndCreateCard(verse: any, alias: string, userId: string, nextDueDate: string, result: any) {
    await db.transaction('rw', db.aliases, db.verse_cards, async (tx) => {
      const now = new Date().toISOString();
      
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

      // Create verse_card
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

      result.local = { verse: verse, verseCard: cardData };
    });
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
      await tx.verse_cards.add(cardData);

      result.local = { verse: localVerseData, verseCard: cardData };
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
   * Supports local-only mode by skipping remote sync when no access token
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
      // Get local verse cards for the user (filter by timestamp if provided)
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

      console.log(`📊 Sync summary: ${finalCardsToSync.length} unverified verses to sync`);

      for (const { card: localCard, verse: localVerse } of finalCardsToSync) {
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
              throw new Error(`ESV API could not validate reference: ${localVerse.reference}`);
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
              result.synced++; // Count as "handled" even though it's invalid
              continue;
            } 
            else {
              console.error(`Failed to validate verse ${localVerse.reference}:`, createError);
              result.failed++;
              result.errors.push(new Error(`Failed to validate verse ${localVerse.reference}: ${createError.message}`));
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
            // Update existing card if remote is newer
            const localUpdated = new Date(localCard.updated_at);
            const remoteUpdated = new Date(remoteCard.updated_at || localCard.updated_at);

            if (remoteUpdated > localUpdated) {
              await db.transaction('rw', db.verse_cards, async (tx) => {
                const updateData = {
                  current_phase: remoteCard.current_phase as 'daily' | 'weekly' | 'biweekly' | 'monthly',
                  phase_progress_count: remoteCard.phase_progress_count,
                  last_reviewed_at: remoteCard.last_reviewed_at || undefined,
                  next_due_date: remoteCard.next_due_date,
                  assigned_day_of_week: remoteCard.assigned_day_of_week,
                  assigned_week_parity: remoteCard.assigned_week_parity,
                  assigned_day_of_month: remoteCard.assigned_day_of_month,
                  archived: remoteCard.archived,
                  current_streak: remoteCard.current_streak,
                  best_streak: remoteCard.best_streak || 0,
                  updated_at: remoteCard.updated_at || new Date().toISOString()
                };
                await tx.verse_cards.update(localCard.id!, updateData);
              });
              result.synced++;
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
    try {
      // Get user profile from remote
      const { data: remoteProfile, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn('No remote user profile found:', error.message);
        return;
      }

      if (remoteProfile) {
        // Check if profile exists locally
        const existingProfile = await db.user_profiles
          .where('user_id')
          .equals(userId)
          .first();

        const profileData: LocalDBSchema['user_profiles'] = {
          id: remoteProfile.id,
          user_id: remoteProfile.user_id,
          email: remoteProfile.email || '',
          full_name: remoteProfile.full_name || '',
          timezone: remoteProfile.timezone || 'UTC',
          preferred_translation: remoteProfile.preferred_translation || 'ESV',
          reference_display_mode: remoteProfile.reference_display_mode || 'first',
          created_at: remoteProfile.created_at || new Date().toISOString(),
          updated_at: remoteProfile.updated_at || new Date().toISOString()
        };

        if (existingProfile) {
          // Update existing profile
          await db.user_profiles.update(existingProfile.id!, profileData);
          console.log('✅ Updated local user profile');
        } else {
          // Create new profile
          await db.user_profiles.add(profileData);
          console.log('✅ Created local user profile');
        }
      }
    } catch (error) {
      console.error('Failed to sync user profile:', error);
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
    return BatchSyncService.queueOperation(type, data, localRef, userId);
  },

  /**
   * Forces immediate processing of the sync queue
   */
  async flushSyncQueue(): Promise<BatchDualWriteResult> {
    return BatchSyncService.flushQueue();
  },

  /**
   * Gets the current sync queue status for debugging/monitoring
   */
  getSyncQueueStatus() {
    return BatchSyncService.getQueueStatus();
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
          const { data: remoteProfile, error: remoteError } = await supabaseClient
            .from('user_profiles')
            .update(updates)
            .eq('user_id', userId)
            .select()
            .single();

          if (remoteError) throw remoteError;
          result.remote = remoteProfile;
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
  }
};

export default dataService;