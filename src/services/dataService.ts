import { localDb, db, type LocalDBSchema } from './localDb';
import { db as supabaseDb, supabaseClient } from './supabase';
import { esvApi } from './esvApi';
import { normalizeReferenceForLookup } from '../utils/referenceNormalizer';
import { processReview, type ReviewPhase } from '../utils/spacedRepetition';
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
   * Syncs local changes to remote database
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
          // Check if this card exists remotely
          const { data: remoteCard } = await supabaseClient
            .from('verse_cards')
            .select('*')
            .eq('id', localCard.id)
            .single();

          if (!remoteCard) {
            // Card doesn't exist remotely, create it
            const { error } = await supabaseDb.verseCards.create({
              id: localCard.id,
              user_id: localCard.user_id,
              verse_id: localCard.verse_id,
              current_phase: localCard.current_phase,
              phase_progress_count: localCard.phase_progress_count,
              last_reviewed_at: localCard.last_reviewed_at,
              next_due_date: localCard.next_due_date,
              archived: localCard.archived,
              current_streak: localCard.current_streak,
              best_streak: localCard.best_streak,
              created_at: localCard.created_at,
              updated_at: localCard.updated_at
            });

            if (error) {
              throw error;
            }
            result.synced++;
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
    verseCardId: number, 
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
      // Step 1: Save review log locally first (fast operation)
      // Note: counted_toward_progress will be determined by database trigger
      const localLog = await localDb.reviewLogs.create({
        user_id: userId,
        verse_card_id: verseCardId,
        was_successful: wasSuccessful,
        counted_toward_progress: false, // Will be updated by trigger if applicable
        review_time_seconds: reviewTimeSeconds || null
      });

      result.local = localLog;

      // Step 2: Database trigger will handle all verse card updates automatically
      // including: phase progression, due dates, streaks, timestamps, etc.
      console.log('Review recorded:', {
        verseCardId,
        wasSuccessful,
        reviewTime: reviewTimeSeconds
      });

      // Step 3: Sync to remote (graceful degradation on failure)
      try {
        // TODO: Implement remote sync with proper ID mapping
        // Database trigger will handle all verse_card updates automatically
        console.warn('Review log remote sync not yet implemented - data saved locally only');
        
        // const remoteLog = await supabaseDb.reviewLogs.create({
        //   user_id: userId,
        //   verse_card_id: remoteVerseCardId, // Would need to map local ID to remote ID
        //   was_successful: wasSuccessful,
        //   review_time_seconds: reviewTimeSeconds
        // });
        
        result.remote = null; // Keeping local-only for now
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