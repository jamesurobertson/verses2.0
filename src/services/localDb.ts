import { Dexie, type EntityTable } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

// Local database schema with UUID string IDs
export interface LocalDBSchema {
  user_profiles: {
    id?: string;                   // UUID string primary key
    user_id: string;               // Foreign key to auth.users
    email: string | null;
    full_name: string | null;
    timezone: string;              // User's timezone for assignment calculations
    preferred_translation: string; // Default 'ESV'
    reference_display_mode: string; // 'full' | 'first' | 'blank'
    created_at: string;
    updated_at: string;
  };

  verses: {
    id?: string;          // UUID string primary key
    reference: string;    // "John 3:16" (canonical ESV format)
    text: string;         // ESV verse text
    translation: string;  // "ESV"
    created_at: string;   // ISO timestamp
    updated_at: string;   // ISO timestamp
  };

  aliases: {
    id?: string;          // UUID string primary key
    alias: string;        // "jn 3:16" (normalized user input)
    verse_id: string;     // Foreign key to verses
    created_at: string;   // ISO timestamp
  };

  verse_cards: {
    id?: string;                   // UUID string primary key
    user_id: string;               // Foreign key to auth.users
    verse_id: string;              // Foreign key to local verses
    current_phase: 'daily' | 'weekly' | 'biweekly' | 'monthly'; // Default 'daily'
    phase_progress_count: number;  // Default 0 - tracks progress within current phase
    last_reviewed_at: string | null;
    next_due_date: string;         // Date string (YYYY-MM-DD format)
    assigned_day_of_week: number | null;    // 1-7 (Sunday=1) for weekly/biweekly
    assigned_week_parity: number | null;    // 0 or 1 for biweekly scheduling
    assigned_day_of_month: number | null;   // 1-28 for monthly scheduling
    archived: boolean;             // Default false
    created_at: string;
    updated_at: string;
    current_streak: number;        // Default 0
    best_streak: number;           // Default 0
  };

  review_logs: {
    id?: string;                   // UUID string primary key
    user_id: string;               // Foreign key to auth.users
    verse_card_id: string;         // Foreign key to local verse_cards
    was_successful: boolean;       // Whether the review was successful
    counted_toward_progress: boolean; // Whether this review counts toward progress
    review_time_seconds: number | null; // Time taken for review
    created_at: string;            // ISO timestamp
  };

}

// Typed Dexie database with EntityTable
const db = new Dexie('VersesDB') as Dexie & {
  user_profiles: EntityTable<LocalDBSchema['user_profiles'], 'id'>;
  verses: EntityTable<LocalDBSchema['verses'], 'id'>;
  aliases: EntityTable<LocalDBSchema['aliases'], 'id'>;
  verse_cards: EntityTable<LocalDBSchema['verse_cards'], 'id'>;
  review_logs: EntityTable<LocalDBSchema['review_logs'], 'id'>;
};


// Version 11: Remove aliases array, add aliases table
db.version(11).stores({
  // UUID string primary keys instead of auto-increment
  user_profiles: 'id, user_id, timezone, [user_id]',
  verse_cards: 'id, user_id, verse_id, next_due_date, current_phase, archived, assigned_day_of_week, assigned_week_parity, assigned_day_of_month, [user_id+verse_id]',
  verses: 'id, reference, translation, [reference+translation]',
  aliases: 'id, alias, verse_id, [alias], [verse_id]',
  review_logs: 'id, user_id, verse_card_id, was_successful, created_at, [verse_card_id+user_id], [user_id+verse_card_id]'
})

// Database hooks for auto-timestamps, UUIDs, and validation
db.verses.hook('creating', function (_primKey, obj, _trans) {
  const now = new Date().toISOString();
  obj.id = obj.id || uuidv4();
  obj.created_at = now;
  obj.updated_at = now;
  obj.translation = obj.translation || 'ESV';
});

db.aliases.hook('creating', function (_primKey, obj, _trans) {
  const now = new Date().toISOString();
  obj.id = obj.id || uuidv4();
  obj.created_at = now;
});

db.verses.hook('updating', function (modifications, _primKey, _obj, _trans) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (modifications as any).updated_at = new Date().toISOString();
});

db.verse_cards.hook('creating', function (_primKey, obj, _trans) {
  const now = new Date().toISOString();
  obj.id = obj.id || uuidv4();
  obj.created_at = now;
  obj.updated_at = now;

  // Set spaced repetition defaults
  obj.current_phase = obj.current_phase || 'daily';
  obj.phase_progress_count = obj.phase_progress_count ?? 0;
  obj.archived = obj.archived ?? false;
  obj.current_streak = obj.current_streak ?? 0;
  obj.best_streak = obj.best_streak ?? 0;

  // Set assignment field defaults
  obj.assigned_day_of_week = obj.assigned_day_of_week ?? null;
  obj.assigned_week_parity = obj.assigned_week_parity ?? null;
  obj.assigned_day_of_month = obj.assigned_day_of_month ?? null;

  // Set next_due_date to today if not provided (new cards available immediately)
  if (!obj.next_due_date) {
    const today = new Date();
    obj.next_due_date = today.toISOString().split('T')[0];
  }
});

db.verse_cards.hook('updating', function (modifications, _primKey, _obj, _trans) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (modifications as any).updated_at = new Date().toISOString();
});

db.review_logs.hook('creating', function (_primKey, obj, _trans) {
  const now = new Date().toISOString();
  obj.id = obj.id || uuidv4();
  obj.created_at = now;
});

db.user_profiles.hook('creating', function (_primKey, obj, _trans) {
  const now = new Date().toISOString();
  obj.id = obj.id || uuidv4();
  obj.created_at = now;
  obj.updated_at = now;

  // Set user profile defaults
  obj.preferred_translation = obj.preferred_translation || 'ESV';
  obj.reference_display_mode = obj.reference_display_mode || 'full';
  obj.timezone = obj.timezone || 'UTC';
});

db.user_profiles.hook('updating', function (modifications, _primKey, _obj, _trans) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (modifications as any).updated_at = new Date().toISOString();
});

// Database helper functions for common operations
export const localDb = {
  // Verses operations
  verses: {
    async findByReference(reference: string, translation: string = 'ESV') {
      return db.verses
        .where('[reference+translation]')
        .equals([reference, translation])
        .first();
    },

    async create(verse: Omit<LocalDBSchema['verses'], 'id' | 'created_at' | 'updated_at'> & { translation?: string }) {
      const now = new Date().toISOString();
      const verseData: LocalDBSchema['verses'] = {
        ...verse,
        translation: verse.translation || 'ESV',
        created_at: now,
        updated_at: now,
        id: uuidv4() // Always generate locally
      };

      await db.verses.add(verseData);

      // Return the created verse
      const createdVerse = await db.verses.get(verseData.id!);
      return createdVerse!;
    },

    async getAll() {
      return db.verses.orderBy('created_at').reverse().toArray();
    },

    async findById(id: string) {
      return db.verses.get(id);
    }
  },

  // Aliases operations
  aliases: {
    async findByAlias(alias: string) {
      return db.aliases
        .where('alias')
        .equals(alias)
        .first();
    },

    async findVerseByAlias(alias: string) {
      const aliasRecord = await this.findByAlias(alias);
      if (!aliasRecord) return null;
      return db.verses.get(aliasRecord.verse_id);
    },

    async create(alias: Omit<LocalDBSchema['aliases'], 'id' | 'created_at'>) {
      const now = new Date().toISOString();
      const aliasData: LocalDBSchema['aliases'] = {
        ...alias,
        created_at: now,
        id: uuidv4()
      };

      await db.aliases.add(aliasData);
      return aliasData;
    },

    async getByVerseId(verseId: string) {
      return db.aliases
        .where('verse_id')
        .equals(verseId)
        .toArray();
    },

    async deleteByVerseId(verseId: string) {
      return db.aliases
        .where('verse_id')
        .equals(verseId)
        .delete();
    }
  },

  // Verse cards operations
  verseCards: {
    async findByUserAndVerse(userId: string, verseId: string) {
      return db.verse_cards
        .where('[user_id+verse_id]')
        .equals([userId, verseId])
        .first();
    },

    async create(card: Omit<LocalDBSchema['verse_cards'], 'id' | 'created_at' | 'updated_at'>) {
      const now = new Date().toISOString();
      const cardData: LocalDBSchema['verse_cards'] = {
        ...card,
        phase_progress_count: card.phase_progress_count ?? 0,
        archived: card.archived ?? false,
        current_streak: card.current_streak ?? 0,
        best_streak: card.best_streak ?? 0,
        current_phase: card.current_phase || 'daily',
        created_at: now,
        updated_at: now,
        id: uuidv4() // Always generate locally
      };

      await db.verse_cards.add(cardData);

      // Return the created card
      const createdCard = await db.verse_cards.get(cardData.id!);
      return createdCard!;
    },

    async getByUser(userId: string) {
      return db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => !card.archived)
        .toArray();
    },

    async getDue(userId: string) {
      const today = new Date().toISOString().split('T')[0];
      return db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => !card.archived && card.next_due_date <= today)
        .toArray();
    },

    async get(id: string) {
      return db.verse_cards.get(id);
    },

    async getReviewedToday(userId: string) {
      const today = new Date().toISOString().split('T')[0];
      return db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => {
          return !card.archived &&
            !!card.last_reviewed_at &&
            card.last_reviewed_at.split('T')[0] === today;
        })
        .toArray();
    }
  },

  // Review logs operations
  reviewLogs: {
    async create(log: Omit<LocalDBSchema['review_logs'], 'id' | 'created_at'>) {
      const now = new Date().toISOString();
      const logData: LocalDBSchema['review_logs'] = {
        ...log,
        created_at: now,
        id: uuidv4() // Always generate locally
      };

      await db.review_logs.add(logData);

      // Return the created log
      const createdLog = await db.review_logs.get(logData.id!);
      return createdLog!;
    },

    async getByUser(userId: string) {
      const logs = await db.review_logs
        .where('user_id')
        .equals(userId)
        .toArray();
      // Sort by created_at in memory since it's indexed
      return logs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getByVerseCard(verseCardId: string) {
      const logs = await db.review_logs
        .where('verse_card_id')
        .equals(verseCardId)
        .toArray();
      // Sort by created_at in memory since it's indexed
      return logs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getStats(userId: string, days: number = 30) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateString = startDate.toISOString();

      return db.review_logs
        .where('user_id')
        .equals(userId)
        .filter(log => log.created_at >= startDateString)
        .toArray();
    }
  },

  // User profiles operations
  userProfiles: {
    async findByUserId(userId: string) {
      return db.user_profiles
        .where('user_id')
        .equals(userId)
        .first();
    },

    async create(profile: Omit<LocalDBSchema['user_profiles'], 'id' | 'created_at' | 'updated_at'>) {
      console.log('creating user profile');
      const now = new Date().toISOString();
      const profileData: LocalDBSchema['user_profiles'] = {
        ...profile,
        preferred_translation: profile.preferred_translation || 'ESV',
        reference_display_mode: profile.reference_display_mode || 'full',
        timezone: profile.timezone || 'UTC',
        created_at: now,
        updated_at: now,
        id: uuidv4() // Always generate locally
      };

      await db.user_profiles.add(profileData);

      // Return the created profile
      const createdProfile = await db.user_profiles.get(profileData.id!);
      return createdProfile!;
    },

    async update(userId: string, updates: Partial<Omit<LocalDBSchema['user_profiles'], 'id' | 'user_id' | 'created_at' | 'updated_at'>>) {
      const profile = await this.findByUserId(userId);
      if (!profile) {
        throw new Error(`User profile not found for user_id: ${userId}`);
      }

      await db.user_profiles.update(profile.id!, {
        ...updates,
        updated_at: new Date().toISOString()
      });

      // Return the updated profile
      return await db.user_profiles.get(profile.id!);
    },

    async getByUserId(userId: string) {
      return this.findByUserId(userId);
    }
  },

  // Utility functions
  async clear() {
    await db.transaction('rw', [db.user_profiles, db.verses, db.aliases, db.verse_cards, db.review_logs], async () => {
      await db.user_profiles.clear();
      await db.verses.clear();
      await db.aliases.clear();
      await db.verse_cards.clear();
      await db.review_logs.clear();
    });
  },

  async close() {
    await db.close();
  },

  async delete() {
    return db.delete();
  }
};

// Export the raw database instance for advanced operations
export { db };

// Export default singleton
export default localDb;
