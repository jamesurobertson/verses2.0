import { Dexie, type EntityTable } from 'dexie';

// Local database schema with auto-increment IDs
export interface LocalDBSchema {
  verses: {
    id?: number;          // Auto-increment primary key
    reference: string;    // "John 3:16" (canonical ESV format)
    aliases: string[];    // ["jn 3:16", "john 3:16", "jhn 3:16"] (normalized user inputs)
    text: string;         // ESV verse text
    translation: string;  // "ESV"
    created_at: string;   // ISO timestamp
    updated_at: string;   // ISO timestamp
  };
  
  verse_cards: {
    id?: number;                   // Auto-increment primary key
    user_id: string;               // Foreign key to auth.users
    verse_id: number;              // Foreign key to local verses
    current_phase: 'daily' | 'weekly' | 'biweekly' | 'monthly'; // Default 'daily'
    phase_progress_count: number;  // Default 0 - tracks progress within current phase
    last_reviewed_at: string | null;
    next_due_date: string;         // Date string (YYYY-MM-DD format)
    archived: boolean;             // Default false
    created_at: string;
    updated_at: string;
    current_streak: number;        // Default 0
    best_streak: number;           // Default 0
  };

  review_logs: {
    id?: number;                   // Auto-increment primary key
    user_id: string;               // Foreign key to auth.users
    verse_card_id: number;         // Foreign key to local verse_cards
    was_successful: boolean;       // Whether the review was successful
    counted_toward_progress: boolean; // Whether this review counts toward progress
    review_time_seconds: number | null; // Time taken for review
    created_at: string;            // ISO timestamp
  };
}

// Typed Dexie database with EntityTable
const db = new Dexie('VersesDB') as Dexie & {
  verses: EntityTable<LocalDBSchema['verses'], 'id'>;
  verse_cards: EntityTable<LocalDBSchema['verse_cards'], 'id'>;
  review_logs: EntityTable<LocalDBSchema['review_logs'], 'id'>;
};

// Database schema definition with spaced repetition support
db.version(8).stores({
  // ++id for auto-increment primary keys, then only fields we actually search/filter by
  verses: '++id, reference, translation, *aliases, [reference+translation]',
  verse_cards: '++id, user_id, verse_id, next_due_date, current_phase, archived, [user_id+verse_id]',
  review_logs: '++id, user_id, verse_card_id, was_successful, created_at, [user_id+verse_card_id]'
});

// Database hooks for auto-timestamps and validation
db.verses.hook('creating', function (_primKey, obj, _trans) {
  const now = new Date().toISOString();
  obj.created_at = now;
  obj.updated_at = now;
  obj.translation = obj.translation || 'ESV';
  obj.aliases = obj.aliases || [];
});

db.verses.hook('updating', function (modifications, _primKey, _obj, _trans) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (modifications as any).updated_at = new Date().toISOString();
});

db.verse_cards.hook('creating', function (_primKey, obj, _trans) {
  const now = new Date().toISOString();
  obj.created_at = now;
  obj.updated_at = now;
  
  // Set spaced repetition defaults
  obj.current_phase = obj.current_phase || 'daily';
  obj.phase_progress_count = obj.phase_progress_count ?? 0;
  obj.archived = obj.archived ?? false;
  obj.current_streak = obj.current_streak ?? 0;
  obj.best_streak = obj.best_streak ?? 0;
  
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
  obj.created_at = now;
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

    async create(verse: Omit<LocalDBSchema['verses'], 'id' | 'created_at' | 'updated_at'> & { translation?: string; aliases?: string[] }) {
      const now = new Date().toISOString();
      const verseData = {
        ...verse,
        translation: verse.translation || 'ESV',
        aliases: verse.aliases || [],
        created_at: now,
        updated_at: now
      };
      
      // Dexie will auto-generate the ID for us with ++id prefix
      const id = await db.verses.add(verseData);
      
      // Return the created verse with the generated ID
      const createdVerse = await db.verses.get(id);
      return createdVerse!;
    },

    async findByAlias(alias: string) {
      // Search for verses that have this alias in their aliases array
      return db.verses
        .filter(verse => verse.aliases && verse.aliases.includes(alias))
        .first();
    },

    async getAll() {
      return db.verses.orderBy('created_at').reverse().toArray();
    },

    async findById(id: number) {
      return db.verses.get(id);
    }
  },

  // Verse cards operations
  verseCards: {
    async findByUserAndVerse(userId: string, verseId: number) {
      return db.verse_cards
        .where('[user_id+verse_id]')
        .equals([userId, verseId])
        .first();
    },

    async create(card: Omit<LocalDBSchema['verse_cards'], 'id' | 'created_at' | 'updated_at'>) {
      const now = new Date().toISOString();
      const cardData = {
        ...card,
        phase_progress_count: card.phase_progress_count ?? 0,
        archived: card.archived ?? false,
        current_streak: card.current_streak ?? 0,
        best_streak: card.best_streak ?? 0,
        current_phase: card.current_phase || 'daily',
        created_at: now,
        updated_at: now
      };
      
      // Dexie will auto-generate the ID for us with ++id prefix
      const id = await db.verse_cards.add(cardData);
      
      // Return the created card with the generated ID
      const createdCard = await db.verse_cards.get(id);
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

    async get(id: number) {
      return db.verse_cards.get(id);
    },

    async getReviewedToday(userId: string) {
      const today = new Date().toISOString().split('T')[0];
      return db.verse_cards
        .where('user_id')
        .equals(userId)
        .filter(card => {
          return !card.archived && 
                 card.last_reviewed_at && 
                 card.last_reviewed_at.split('T')[0] === today;
        })
        .toArray();
    }
  },

  // Review logs operations
  reviewLogs: {
    async create(log: Omit<LocalDBSchema['review_logs'], 'id' | 'created_at'>) {
      const now = new Date().toISOString();
      const logData = {
        ...log,
        created_at: now
      };
      
      // Dexie will auto-generate the ID for us with ++id prefix
      const id = await db.review_logs.add(logData);
      
      // Return the created log with the generated ID
      const createdLog = await db.review_logs.get(id);
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

    async getByVerseCard(verseCardId: number) {
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

  // Utility functions
  async clear() {
    await db.transaction('rw', db.verses, db.verse_cards, db.review_logs, async () => {
      await db.verses.clear();
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