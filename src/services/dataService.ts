import { db, type LocalDBSchema } from './localDb';
import { supabaseClient, db as supabaseDb } from './supabase';
import { normalizeReferenceForLookup } from '../utils/referenceNormalizer';
import { getTodayString } from '../utils/dateUtils';

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
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
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
   * Adds a new verse with optimized 3-step flow:
   * 1. Check local database (verses + aliases table)
   * 2. Check remote database (Supabase verses + aliases)  
   * 3. ESV API as last resort
   * ✅ NO async calls inside transactions (follows Dexie best practices)
   */
  async addVerse(
    reference: string,
    userId: string,
    accessToken?: string
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
        await this.syncVerseToRemote(result.local!.verse, result.local!.verseCard, result);
        result.success = true;
        return result;
      }

      // STEP 2: Check Remote Database via Secure Edge Function
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

      // STEP 3: This should not happen - edge function handles ESV API calls
      // If we reach here, there was an error in the edge function flow
      throw new ValidationError('Unable to process verse - please try again');
    } catch (error) {
      if (error instanceof DuplicateVerseError || error instanceof ValidationError) {
        throw error;
      }
      if (!result.local) {
        result.errors.local = error as Error;
      }
      throw new Error(`Failed to add verse: ${(error as Error).message}`);
    }
  },

  // Helper methods for addVerse
  async syncVerseToRemote(verse: LocalDBSchema['verses'], verseCard: LocalDBSchema['verse_cards'], result: any) {
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

  // This method is no longer needed - edge functions handle verse creation
  async createNewVerseEverywhere(_reference: string, _text: string, _alias: string, _userId: string, _nextDueDate: string, _result: any) {
    // Edge functions now handle verse creation securely
    // This method should not be called in the new architecture
    throw new Error('Verse creation is now handled by secure edge functions');
  },

  /**
   * Records a review log entry with dual-write strategy
   * ✅ FIXED: Transaction contains only Dexie operations, external calls outside
   */
  async recordReview(
    verseCardId: string,
    userId: string,
    wasSuccessful: boolean,
    reviewTimeSeconds?: number
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
      const todayUTC = new Date().toISOString().split('T')[0];
      
      await db.transaction('rw', db.review_logs, async (tx) => {
        // Check for existing review today within transaction
        const existingReview = await tx.review_logs
          .where(['verse_card_id', 'user_id'])
          .equals([verseCardId, userId])
          .filter(log => {
            const logDate = new Date(log.created_at).toISOString().split('T')[0];
            return logDate === todayUTC;
          })
          .first();

        if (existingReview) {
          throw new Error('Review already recorded for today');
        }

        // Create review log within transaction
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

      // Filter by lastSyncTimestamp if provided for incremental sync
      if (lastSyncTimestamp) {
        localCards = localCards.filter(card =>
          new Date(card.updated_at) > new Date(lastSyncTimestamp)
        );
      }

      for (const localCard of localCards) {
        try {
          // Get the verse for this card
          const localVerse = await db.verses.get(localCard.verse_id);
          if (!localVerse) {
            throw new Error(`Local verse not found for card ${localCard.id}`);
          }

          // Step 1: Ensure the verse exists remotely (should already exist due to edge functions)
          // Just get the remote verse by reference since edge functions maintain consistency
          const { data: remoteVerse, error: verseError } = await supabaseDb.verses.getByReference(
            localVerse.reference,
            localVerse.translation
          );

          if (verseError || !remoteVerse) {
            // If verse doesn't exist remotely, skip sync (this shouldn't happen with new architecture)
            console.warn(`Verse ${localVerse.reference} not found remotely, skipping sync`);
            result.failed++;
            result.errors.push(new Error(`Verse ${localVerse.reference} not found remotely`));
            continue;
          }

          

          // Step 2: Check if verse card exists remotely and handle accordingly
          // This logic could be moved to a helper function in supabase.ts for better abstraction
          
          // Create the card using the helper
          const {error: cardError, statusText} = await supabaseDb.verseCards.findOrCreate({...localCard, verse_id: remoteVerse.id});
          
          if (statusText === "found") {
            // Card already exists remotely, no need to sync
            console.log('Verse card already exists remotely');
          } else if (!cardError) {
            result.synced++;
          } else if (cardError?.code === '23505') { // Unique constraint violation
            // Card already exists, could update if needed
            console.log('Verse card already exists remotely, skipping');
          } else {
            throw cardError;
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
  }
};

export default dataService;