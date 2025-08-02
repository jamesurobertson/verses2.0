# Dexie Dual-Write Architecture Overview

## Introduction

The Verses Bible Memory App implements a sophisticated **dual-write architecture** that prioritizes offline functionality while maintaining cloud synchronization capabilities. This document provides a comprehensive technical overview of the implementation using Dexie (IndexedDB) as the local storage layer and Supabase as the remote cloud database.

## Architecture Philosophy

### Offline-First Design

The core principle is that the application should function completely offline, with cloud synchronization serving as an enhancement rather than a requirement. This ensures:

- **Instant responsiveness** - No waiting for network requests
- **Reliable operation** - Works in poor network conditions
- **Data persistence** - User data is never lost due to connectivity issues
- **Progressive enhancement** - Cloud features enhance but don't block core functionality

### Dual-Write Strategy

Every data operation follows this pattern:
1. **Local Write First** - Save to IndexedDB immediately for instant UI updates
2. **Remote Sync** - Attempt to sync to Supabase with graceful failure handling
3. **Error Isolation** - Local operations succeed even if remote operations fail

## Technical Implementation

### Database Schema

The local Dexie database mirrors the Supabase schema with adaptations for IndexedDB:

```typescript
interface LocalDBSchema {
  verses: {
    id?: number;          // Auto-increment primary key
    reference: string;    // "John 3:16"
    text: string;         // ESV verse text
    translation: string;  // "ESV"
    created_at: string;   // ISO timestamp
    updated_at: string;   // ISO timestamp
  };
  
  verse_cards: {
    id?: number;                   // Auto-increment primary key
    user_id: string;               // Foreign key to auth.users
    verse_id: number;              // Foreign key to local verses
    current_phase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    phase_progress_count: number;  // Default 0
    last_reviewed_at: string | null;
    next_due_date: string;         // Date string
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
```

### Key Design Decisions

#### Auto-Increment vs UUID Primary Keys

- **Local Database**: Uses auto-increment integer IDs for simplicity and performance
- **Remote Database**: Uses UUIDs for global uniqueness
- **Mapping**: Local and remote IDs are kept separate to avoid conflicts

#### Schema Versioning

```typescript
db.version(4).stores({
  verses: '++id, reference, translation, created_at, [reference+translation]',
  verse_cards: '++id, user_id, verse_id, next_due_date, current_phase, [user_id+verse_id]',
  review_logs: '++id, user_id, verse_card_id, was_successful, created_at, [user_id+verse_card_id]'
});
```

- Compound indexes optimize common query patterns
- Version numbers enable safe schema migrations
- Index design supports both filtering and sorting operations

## Data Service Layer

### Dual-Write Operations

The `dataService` module orchestrates dual-write operations:

```typescript
async addVerse(reference: string, userId: string): Promise<DualWriteResult<{
  verse: LocalDBSchema['verses'];
  verseCard: LocalDBSchema['verse_cards'];
}>> {
  const result: DualWriteResult = {
    local: null,
    remote: null,
    errors: {},
    success: false
  };

  try {
    // Step 1: Validate and parse the reference
    const parsedRef = parseBibleReference(reference);
    
    // Step 2: Check for duplicates in local database
    const localExistingVerse = await localDb.verses.findByReference(normalizedRef);
    
    // Step 3: Fetch verse text from ESV API
    const esvResponse = await esvApi.getPassage(normalizedRef);
    
    // Step 4: Create verse locally first (fast operation)
    const localVerse = await localDb.verses.create({
      reference: normalizedRef,
      text: verseText,
      translation: 'ESV'
    });
    
    // Step 5: Create verse card locally
    const localVerseCard = await localDb.verseCards.create({
      user_id: userId,
      verse_id: localVerse.id!,
      current_phase: 'daily',
      // ... other properties
    });
    
    result.local = { verse: localVerse, verseCard: localVerseCard };
    
    // Step 6: Sync to remote (graceful degradation on failure)
    try {
      const remoteVerse = await supabaseDb.verses.findOrCreate(normalizedRef, verseText, 'ESV');
      // Note: Database trigger automatically creates verse card
      
      const { data: autoCreatedCard } = await supabaseClient
        .from('verse_cards')
        .select('*')
        .eq('user_id', userId)
        .eq('verse_id', remoteVerse.data.id)
        .maybeSingle();
        
      result.remote = { verse: remoteVerse.data, verseCard: autoCreatedCard };
    } catch (error) {
      result.errors.remote = new NetworkError('Failed to sync to remote database - data saved locally', error);
    }
    
    result.success = true;
    return result;
  } catch (error) {
    // Handle local failures and errors
  }
}
```

### Error Handling Strategy

#### Error Types

```typescript
export class DuplicateVerseError extends Error {
  constructor(reference: string, existing: any) {
    super(`Verse "${reference}" already exists in your collection`);
    this.existing = existing;
  }
}

export class NetworkError extends Error {
  constructor(message: string, originalError?: Error) {
    super(message);
    this.originalError = originalError;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}
```

#### Error Isolation

- **Local errors** block the entire operation (data integrity critical)
- **Remote errors** are logged but don't prevent local success
- **User feedback** distinguishes between local and sync failures

## Review System Integration

### Review Log Tracking

The review system demonstrates sophisticated dual-write patterns:

```typescript
async recordReview(
  verseCardId: number, 
  userId: string, 
  wasSuccessful: boolean, 
  countedTowardProgress: boolean = true,
  reviewTimeSeconds?: number
): Promise<DualWriteResult<LocalDBSchema['review_logs']>> {
  // Step 1: Save review log locally first
  const localLog = await localDb.reviewLogs.create({
    user_id: userId,
    verse_card_id: verseCardId,
    was_successful: wasSuccessful,
    counted_toward_progress: countedTowardProgress,
    review_time_seconds: reviewTimeSeconds || null
  });

  // Step 2: Update verse card progress locally
  if (wasSuccessful && countedTowardProgress) {
    const verseCard = await localDb.verseCards.get(verseCardId);
    if (verseCard) {
      await db.verse_cards.update(verseCardId, {
        current_streak: verseCard.current_streak + 1,
        best_streak: Math.max(verseCard.best_streak, verseCard.current_streak + 1),
        last_reviewed_at: new Date().toISOString()
      });
    }
  } else if (!wasSuccessful) {
    await db.verse_cards.update(verseCardId, {
      current_streak: 0,
      last_reviewed_at: new Date().toISOString()
    });
  }

  // Step 3: Sync to remote (when database triggers are fixed)
  // Currently disabled due to Supabase trigger issues
  
  return result;
}
```

### Streak Management

Streak calculations happen immediately in the local database:
- **Successful reviews** increment `current_streak` and update `best_streak`
- **Failed reviews** reset `current_streak` to 0
- **Last reviewed** timestamp tracks recency for due date calculations

## Query Optimization

### Local Database Queries

#### Due Cards Query
```typescript
async getDue(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  return db.verse_cards
    .where('user_id')
    .equals(userId)
    .filter(card => !card.archived && card.next_due_date <= today)
    .toArray();
}
```

#### Compound Index Usage
```typescript
// Find verse by reference and translation
async findByReference(reference: string, translation: string = 'ESV') {
  return db.verses
    .where('[reference+translation]')
    .equals([reference, translation])
    .first();
}

// Find user's verse card for specific verse
async findByUserAndVerse(userId: string, verseId: number) {
  return db.verse_cards
    .where('[user_id+verse_id]')
    .equals([userId, verseId])
    .first();
}
```

### Performance Optimizations

- **Compound indexes** reduce query complexity from O(n) to O(log n)
- **Selective loading** only loads required fields for list views
- **Lazy loading** defers verse text loading until needed
- **Batch operations** group multiple database writes

## Synchronization Patterns

### Current Implementation

The current implementation prioritizes local functionality:

1. **Immediate local writes** for all user operations
2. **Selective remote sync** for verses (working) and review logs (planned)
3. **Manual refresh** triggers sync attempts
4. **Graceful degradation** when remote operations fail

### Future Enhancements

#### Background Sync
- Service worker integration for offline sync
- Periodic background sync when network available
- Conflict resolution for divergent local/remote state

#### Bidirectional Sync
- Remote change detection and local merge
- Cross-device synchronization
- Optimistic concurrency control

#### Data Migration
- Export/import functionality for data portability
- Backup and restore capabilities
- Schema migration tools

## Database Administration

### Local Database Management

```typescript
// Clear all local data
await localDb.clear();

// Close database connection
await localDb.close();

// Delete entire database
await localDb.delete();

// Get database statistics
const verseCount = await localDb.verses.getAll().then(v => v.length);
const cardCount = await localDb.verseCards.getByUser(userId).then(c => c.length);
```

### Development Tools

#### Database Inspection
```typescript
// Debug helper to inspect database state
export const dbDebug = {
  async dumpAll() {
    const verses = await db.verses.toArray();
    const cards = await db.verse_cards.toArray();
    const logs = await db.review_logs.toArray();
    console.log({ verses, cards, logs });
  },
  
  async verifyIntegrity() {
    // Check for orphaned records, inconsistent state
  }
};
```

#### Schema Migrations
```typescript
// Example migration for new fields
db.version(5).stores({
  // Add new index or field
  verse_cards: '++id, user_id, verse_id, next_due_date, current_phase, difficulty, [user_id+verse_id]'
}).upgrade(tx => {
  // Migrate existing data
  return tx.verse_cards.toCollection().modify(card => {
    card.difficulty = 'medium'; // Set default value
  });
});
```

## Testing Strategy

### Unit Testing

```typescript
describe('localDb.verses', () => {
  beforeEach(async () => {
    await localDb.clear();
  });

  test('creates verse with auto-generated ID', async () => {
    const verse = await localDb.verses.create({
      reference: 'John 3:16',
      text: 'For God so loved the world...',
      translation: 'ESV'
    });
    
    expect(verse.id).toBeDefined();
    expect(verse.reference).toBe('John 3:16');
  });
});
```

### Integration Testing

```typescript
describe('dataService.addVerse', () => {
  test('handles offline scenario gracefully', async () => {
    // Mock network failure
    jest.spyOn(supabaseDb.verses, 'findOrCreate').mockRejectedValue(new Error('Network error'));
    
    const result = await dataService.addVerse('Psalm 23:1', 'user123');
    
    expect(result.success).toBe(true);
    expect(result.local).toBeDefined();
    expect(result.errors.remote).toBeDefined();
  });
});
```

## Security Considerations

### Data Validation

All data is validated at entry points:
```typescript
const verseSchema = z.object({
  reference: z.string().min(1).max(50),
  text: z.string().min(1).max(2000),
  translation: z.string().min(1).max(10)
});
```

### User Data Isolation

- **User ID filtering** ensures users only access their own data
- **Local storage scoping** by authenticated user
- **No cross-user data leakage** in local database

### Sanitization

```typescript
import DOMPurify from 'dompurify';

const sanitizeVerseText = (text: string): string => {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
};
```

## Monitoring and Observability

### Performance Metrics

```typescript
export const dbMetrics = {
  async getStats() {
    return {
      totalVerses: await db.verses.count(),
      totalCards: await db.verse_cards.count(),
      totalReviews: await db.review_logs.count(),
      dbSize: await navigator.storage?.estimate?.()
    };
  }
};
```

### Error Tracking

```typescript
const logDualWriteError = (operation: string, error: Error, context: any) => {
  console.error(`Dual-write ${operation} failed:`, {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
  
  // In production, send to error tracking service
  // errorTracker.captureException(error, { context });
};
```

## Conclusion

The Dexie-based dual-write architecture provides a robust foundation for offline-first Bible memorization. Key benefits include:

- **Immediate responsiveness** through local-first operations
- **Data reliability** with local persistence as primary source
- **Progressive enhancement** with cloud sync as bonus feature
- **Graceful degradation** maintaining functionality offline
- **Scalable design** supporting future synchronization enhancements

This architecture ensures users can rely on the app for their memorization practice regardless of network conditions, while still benefiting from cloud backup and cross-device sync when available.

The implementation demonstrates how modern web applications can provide native-app-like reliability using IndexedDB and thoughtful dual-write patterns, making offline functionality a first-class feature rather than an afterthought.