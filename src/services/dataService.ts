import { localDb, db, type LocalDBSchema } from './localDb';
import { db as supabaseDb, supabaseClient } from './supabase';
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
  async addVerse(reference: string, userId: string): Promise<DualWriteResult<{
    verse: LocalDBSchema['verses'];
    verseCard: LocalDBSchema['verse_cards'];
  }>> {
    const result: DualWriteResult<{
      verse: LocalDBSchema['verses'];
      verseCard: LocalDBSchema['verse_cards'];
    }> = {
      local: null,
      remote: null,
      errors: {},
      success: false
    };

    try {
      // Step 1: Normalize user input for alias lookup
      const normalizedInput = normalizeReferenceForLookup(reference);

      // Step 2: Check if we already know this reference (alias lookup)
      let existingVerse = await localDb.verses.findByAlias(normalizedInput);

      if (existingVerse) {
        // We know this verse - check if THIS USER already has it
        const existingCard = await localDb.verseCards.findByUserAndVerse(userId, existingVerse.id!);
        if (existingCard) {
          throw new DuplicateVerseError(existingVerse.reference, {
            verse: existingVerse,
            verseCard: existingCard
          });
        }
      } else {
        // Unknown reference - query ESV API (they handle complex parsing)
        const esvResponse = await esvApi.getPassage(reference);
        if (!esvResponse.passages || esvResponse.passages.length === 0) {
          throw new ValidationError('No verse text found for this reference');
        }

        const canonicalRef = esvResponse.canonical;
        const verseText = esvResponse.passages[0].trim();

        // Check if we already have this canonical reference
        existingVerse = await localDb.verses.findByReference(canonicalRef);

        if (existingVerse) {
          // Add this user's input as a new alias
          const currentAliases = existingVerse.aliases || [];
          if (!currentAliases.includes(normalizedInput)) {
            await db.verses.update(existingVerse.id!, {
              aliases: [...currentAliases, normalizedInput]
            });
            // Update our local reference
            existingVerse.aliases = [...currentAliases, normalizedInput];
          }

          // Check if THIS USER already has this verse
          const existingCard = await localDb.verseCards.findByUserAndVerse(userId, existingVerse.id!);
          if (existingCard) {
            throw new DuplicateVerseError(canonicalRef, {
              verse: existingVerse,
              verseCard: existingCard
            });
          }
        } else {
          // Completely new verse - create it with user's input as first alias
          existingVerse = await localDb.verses.create({
            reference: canonicalRef,
            text: verseText,
            translation: 'ESV',
            aliases: [normalizedInput]
          });
        }
      }

      // Step 3: Create verse card for this user
      const nextDueDate = getTodayString();

      const localVerseCard = await localDb.verseCards.create({
        user_id: userId,
        verse_id: existingVerse.id!,
        current_phase: 'daily',
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: nextDueDate,
        assigned_day_of_week: null,     // New daily cards don't need assignment
        assigned_week_parity: null,     // Will be assigned when they advance to weekly/biweekly
        assigned_day_of_month: null,    // Will be assigned when they advance to monthly
        archived: false,
        current_streak: 0,
        best_streak: 0
      });

      result.local = {
        verse: existingVerse,
        verseCard: localVerseCard
      };

      // Step 4: Sync to remote (graceful degradation on failure)
      try {
        // TODO: Implement remote sync with aliases
        console.warn('Remote sync with aliases not yet implemented');
      } catch (error) {
        result.errors.remote = new NetworkError(
          'Failed to sync to remote database - data saved locally',
          error as Error
        );
      }

      result.success = true;
      return result;

    } catch (error) {
      if (error instanceof DuplicateVerseError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to add verse: ${(error as Error).message}`);
    }
  },

  /**
   * Syncs local changes to remote database using content-based matching
   */
  async syncToRemote(userId: string): Promise<{
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
      // Get all local verse cards for the user
      const localCards = await localDb.verseCards.getByUser(userId);

      for (const localCard of localCards) {
        try {
          // Get the verse for this card
          const localVerse = await localDb.verses.findById(localCard.verse_id);
          if (!localVerse) {
            throw new Error(`Local verse not found for card ${localCard.id}`);
          }

          // Step 1: Ensure the verse exists remotely
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
  async syncFromRemote(userId: string): Promise<{
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
      // Get all remote verse cards for the user
      const { data: remoteCards, error: cardsError } = await supabaseClient
        .from('verse_cards')
        .select(`
          *,
          verses!inner(*)
        `)
        .eq('user_id', userId);

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
   * Performs bidirectional sync between local and remote databases
   */
  async fullSync(userId: string): Promise<{
    toRemote: { synced: number; failed: number; errors: Error[] };
    fromRemote: { synced: number; failed: number; errors: Error[] };
  }> {
    const toRemote = await this.syncToRemote(userId);
    const fromRemote = await this.syncFromRemote(userId);
    
    return { toRemote, fromRemote };
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
