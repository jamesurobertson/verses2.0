import { localDb, db, type LocalDBSchema } from './localDb';
import { supabaseClient } from './supabase';
import { esvApi } from './esvApi';
import { normalizeReferenceForLookup } from '../utils/referenceNormalizer';
// import { processReview, type ReviewPhase } from '../utils/spacedRepetition';
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


// Unified data service for dual-write operations
export const dataService = {
  /**
   * Adds a new verse with alias-based lookup and dual-write strategy
   */
  async addVerse(
    reference: string,
    userId: string
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
  
    let existingVerse: LocalDBSchema['verses'] | undefined =
      await localDb.verses.findByAlias(normalizedInput);
  
    let esvCanonicalRef: string | null = null;
    let esvVerseText: string | null = null;
  
    try {
      // If we don't have it by alias, do ESV lookup up front to get canonical and text
      if (!existingVerse) {
        const esvResponse = await esvApi.getPassage(reference);
        if (!esvResponse.passages || esvResponse.passages.length === 0) {
          throw new ValidationError('No verse text found for this reference');
        }
        esvCanonicalRef = esvResponse.canonical;
        esvVerseText = esvResponse.passages[0].trim();
  
        // Try to resolve by canonical reference locally
        existingVerse = await localDb.verses.findByReference(esvCanonicalRef);
      }
  
      // Local transaction: dedupe, create verse if needed, create verse card
      await db.transaction('rw', db.verses, db.verse_cards, async () => {
        // Re-check alias to avoid race
        if (!existingVerse) {
          existingVerse = await localDb.verses.findByAlias(normalizedInput);
        }
  
        if (existingVerse) {
          // Ensure user doesn't already have a card
          const existingCard = await localDb.verseCards.findByUserAndVerse(
            userId,
            existingVerse.id!
          );
          if (existingCard) {
            throw new DuplicateVerseError(existingVerse.reference, {
              verse: existingVerse,
              verseCard: existingCard
            });
          }
        } else if (esvCanonicalRef && esvVerseText !== null) {
          // Try again by canonical reference for safety
          existingVerse = await localDb.verses.findByReference(esvCanonicalRef);
          if (existingVerse) {
            // Attach alias if missing
            const currentAliases = existingVerse.aliases || [];
            if (!currentAliases.includes(normalizedInput)) {
              await db.verses.update(existingVerse.id!, {
                aliases: [...currentAliases, normalizedInput]
              });
              existingVerse.aliases = [...currentAliases, normalizedInput];
            }
  
            const existingCard = await localDb.verseCards.findByUserAndVerse(
              userId,
              existingVerse.id!
            );
            if (existingCard) {
              throw new DuplicateVerseError(esvCanonicalRef, {
                verse: existingVerse,
                verseCard: existingCard
              });
            }
          } else {
            // Create completely new verse
            existingVerse = await localDb.verses.create({
              reference: esvCanonicalRef,
              text: esvVerseText,
              translation: 'ESV',
              aliases: [normalizedInput]
            });
          }
        } else {
          // Shouldn't happen: no alias and no ESV data
          throw new ValidationError('Unable to resolve verse reference');
        }
  
        // At this point we have a verse and confirmed no duplicate card for this user
        const localVerseCard = await localDb.verseCards.create({
          user_id: userId,
          verse_id: existingVerse.id!,
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
  
        result.local = {
          verse: existingVerse,
          verseCard: localVerseCard
        };
      });
  
      // Remote sync (outside transaction)
      try {
        // Ensure verse exists remotely (by shared UUID)
        const { data: existingRemoteVerse, error: fetchVerseError } =
          await supabaseClient
            .from('verses')
            .select('*')
            .eq('id', result.local!.verse.id)
            .single();
  
        if (fetchVerseError && fetchVerseError.code !== 'PGRST116') {
          // PGRST116 is "no rows" in Supabase-land; proceed to insert if not found
          // but treat other errors as fatal for remote sync
          throw fetchVerseError;
        }
  
        if (!existingRemoteVerse) {
          const { error: insertVerseError } = await supabaseClient
            .from('verses')
            .insert({
              id: result.local!.verse.id,
              reference: result.local!.verse.reference,
              text: result.local!.verse.text,
              translation: result.local!.verse.translation,
              aliases: result.local!.verse.aliases
            });
  
          if (insertVerseError) {
            throw insertVerseError;
          }
        }
  
        // Insert remote verse card with same UUID (ignore duplicate remote errors gracefully)
        const { error: cardError } = await supabaseClient.from('verse_cards').insert({
          id: result.local!.verseCard.id,
          user_id: result.local!.verseCard.user_id,
          verse_id: result.local!.verseCard.verse_id,
          current_phase: result.local!.verseCard.current_phase,
          phase_progress_count: result.local!.verseCard.phase_progress_count,
          last_reviewed_at: result.local!.verseCard.last_reviewed_at,
          next_due_date: result.local!.verseCard.next_due_date,
          assigned_day_of_week: result.local!.verseCard.assigned_day_of_week,
          assigned_week_parity: result.local!.verseCard.assigned_week_parity,
          assigned_day_of_month: result.local!.verseCard.assigned_day_of_month,
          archived: result.local!.verseCard.archived,
          current_streak: result.local!.verseCard.current_streak,
          best_streak: result.local!.verseCard.best_streak
        });
  
        if (cardError) {
          throw cardError;
        }
      } catch (err) {
        result.errors.remote = new NetworkError(
          'Failed to sync to remote database - data saved locally',
          err as Error
        );
      }
  
      result.success = true;
      return result;
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

  /**
   * Syncs local changes to remote database using content-based matching
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
      let localCards = await localDb.verseCards.getByUser(userId);

      // Filter by lastSyncTimestamp if provided for incremental sync
      if (lastSyncTimestamp) {
        localCards = localCards.filter(card =>
          new Date(card.updated_at) > new Date(lastSyncTimestamp)
        );
      }

      for (const localCard of localCards) {
        try {
          // Get the verse for this card
          const localVerse = await localDb.verses.findById(localCard.verse_id);
          if (!localVerse) {
            throw new Error(`Local verse not found for card ${localCard.id}`);
          }

          // Step 1: Ensure the verse exists remotely (use shared UUID)
          let remoteVerse;
          const { data: existingRemoteVerse } = await supabaseClient
            .from('verses')
            .select('*')
            .eq('reference', localVerse.reference)
            .eq('translation', localVerse.translation)
            .single();

          if (existingRemoteVerse) {
            remoteVerse = existingRemoteVerse;
          } else {
            // Create verse remotely
            const { data: newRemoteVerse, error: verseError } = await supabaseClient
              .from('verses')
              .insert({
                reference: localVerse.reference,
                text: localVerse.text,
                translation: localVerse.translation,
                aliases: localVerse.aliases
              })
              .select()
              .single();

            if (verseError) {
              throw verseError;
            }
            remoteVerse = newRemoteVerse;
          }

          // Step 2: Check if verse card exists remotely (match by user_id + verse reference)
          const { data: existingRemoteCard } = await supabaseClient
            .from('verse_cards')
            .select('*')
            .eq('user_id', localCard.user_id)
            .eq('verse_id', remoteVerse.id)
            .single();

          if (!existingRemoteCard) {
            // Create verse card remotely
            const { error: cardError } = await supabaseClient
              .from('verse_cards')
              .insert({
                user_id: localCard.user_id,
                verse_id: remoteVerse.id,
                current_phase: localCard.current_phase,
                phase_progress_count: localCard.phase_progress_count,
                last_reviewed_at: localCard.last_reviewed_at,
                next_due_date: localCard.next_due_date,
                assigned_day_of_week: localCard.assigned_day_of_week,
                assigned_week_parity: localCard.assigned_week_parity,
                assigned_day_of_month: localCard.assigned_day_of_month,
                archived: localCard.archived,
                current_streak: localCard.current_streak,
                best_streak: localCard.best_streak
              });

            if (cardError) {
              throw cardError;
            }
            result.synced++;
          } else {
            // Update existing card if local is newer
            const localUpdated = new Date(localCard.updated_at);
            const remoteUpdated = new Date(existingRemoteCard.updated_at);

            if (localUpdated > remoteUpdated) {
              const { error: updateError } = await supabaseClient
                .from('verse_cards')
                .update({
                  current_phase: localCard.current_phase,
                  phase_progress_count: localCard.phase_progress_count,
                  last_reviewed_at: localCard.last_reviewed_at,
                  next_due_date: localCard.next_due_date,
                  assigned_day_of_week: localCard.assigned_day_of_week,
                  assigned_week_parity: localCard.assigned_week_parity,
                  assigned_day_of_month: localCard.assigned_day_of_month,
                  archived: localCard.archived,
                  current_streak: localCard.current_streak,
                  best_streak: localCard.best_streak,
                  updated_at: localCard.updated_at
                })
                .eq('id', existingRemoteCard.id);

              if (updateError) {
                throw updateError;
              }
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
   * Syncs remote changes to local database using content-based matching
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

          // Step 1: Ensure the verse exists locally
          let localVerse = await localDb.verses.findByReference(
            remoteVerse.reference,
            remoteVerse.translation
          );

          if (!localVerse) {
            // Create verse locally
            localVerse = await localDb.verses.create({
              reference: remoteVerse.reference,
              text: remoteVerse.text,
              translation: remoteVerse.translation,
              aliases: remoteVerse.aliases || []
            });
          }

          // Step 2: Check if verse card exists locally
          const localCard = await localDb.verseCards.findByUserAndVerse(
            userId,
            localVerse.id!
          );

          if (!localCard) {
            // Create verse card locally
            await localDb.verseCards.create({
              user_id: remoteCard.user_id,
              verse_id: localVerse.id!,
              current_phase: remoteCard.current_phase,
              phase_progress_count: remoteCard.phase_progress_count,
              last_reviewed_at: remoteCard.last_reviewed_at,
              next_due_date: remoteCard.next_due_date,
              assigned_day_of_week: remoteCard.assigned_day_of_week,
              assigned_week_parity: remoteCard.assigned_week_parity,
              assigned_day_of_month: remoteCard.assigned_day_of_month,
              archived: remoteCard.archived,
              current_streak: remoteCard.current_streak,
              best_streak: remoteCard.best_streak
            });
            result.synced++;
          } else {
            // Update existing card if remote is newer
            const localUpdated = new Date(localCard.updated_at);
            const remoteUpdated = new Date(remoteCard.updated_at);

            if (remoteUpdated > localUpdated) {
              await db.verse_cards.update(localCard.id!, {
                current_phase: remoteCard.current_phase,
                phase_progress_count: remoteCard.phase_progress_count,
                last_reviewed_at: remoteCard.last_reviewed_at,
                next_due_date: remoteCard.next_due_date,
                assigned_day_of_week: remoteCard.assigned_day_of_week,
                assigned_week_parity: remoteCard.assigned_week_parity,
                assigned_day_of_month: remoteCard.assigned_day_of_month,
                archived: remoteCard.archived,
                current_streak: remoteCard.current_streak,
                best_streak: remoteCard.best_streak,
                updated_at: remoteCard.updated_at
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

    // Get local verses
    const localCards = await localDb.verseCards.getByUser(userId);

    for (const card of localCards) {
      // Get verse data
      const verse = await localDb.verses.findById(card.verse_id);
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
   * Records a review log entry with dual-write strategy
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
      // Step 1: Check for existing review today (race condition protection)
      // Use UTC dates for consistency with backend unique constraint
      const todayUTC = new Date().toISOString().split('T')[0];
      const existingReview = await db.review_logs
        .where(['verse_card_id', 'user_id'])
        .equals([verseCardId, userId])
        .filter(log => {
          const logDate = new Date(log.created_at).toISOString().split('T')[0];
          return logDate === todayUTC;
        })
        .first();

      if (existingReview) {
        throw new Error('Card already reviewed today');
      }

      // Step 2: Save review log locally first (fast operation)
      // Note: counted_toward_progress will be determined by database trigger
      const localLog = await localDb.reviewLogs.create({
        user_id: userId,
        verse_card_id: verseCardId,
        was_successful: wasSuccessful,
        counted_toward_progress: false, // Will be updated by trigger if applicable
        review_time_seconds: reviewTimeSeconds || null
      });

      result.local = localLog;

      // Step 3: Database trigger will handle all verse card updates automatically
      // including: phase progression, due dates, streaks, timestamps, etc.
      console.log('Review recorded:', {
        verseCardId,
        wasSuccessful,
        reviewTime: reviewTimeSeconds
      });

      // Step 4: Sync to remote (graceful degradation on failure)
      try {
        // Find the corresponding remote verse card to sync the review
        const localCard = await localDb.verseCards.get(verseCardId);
        if (localCard) {
          const localVerse = await localDb.verses.findById(localCard.verse_id);
          if (localVerse) {
            // Find remote verse by reference+translation
            const { data: remoteVerse } = await supabaseClient
              .from('verses')
              .select('id')
              .eq('reference', localVerse.reference)
              .eq('translation', localVerse.translation)
              .single();

            if (remoteVerse) {
              // Find remote card by user_id + verse_id
              const { data: remoteCard } = await supabaseClient
                .from('verse_cards')
                .select('id')
                .eq('user_id', userId)
                .eq('verse_id', remoteVerse.id)
                .single();

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
  }
};

export default dataService;
