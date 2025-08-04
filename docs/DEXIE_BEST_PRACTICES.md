# Dexie Best Practices - Preventing PrematureCommitError

## Root Causes of PrematureCommitError

The `PrematureCommitError` occurs when:

1. **External async operations inside transactions** (API calls, setTimeout, etc.)
2. **Using wrapper methods inside transactions** (like `localDb.verses.create()`)
3. **Long-running operations** that cause transaction timeout
4. **Mixing transaction contexts** (calling other DB operations during a transaction)

## Critical Issues Found in Current Code

### ❌ dataService.ts - Line 96-171
```typescript
await db.transaction('rw', db.verses, db.verse_cards, async () => {
  // ❌ WRONG: Using localDb wrapper inside transaction
  existingVerse = await localDb.verses.findByAlias(normalizedInput);
  
  // ❌ WRONG: Using localDb wrapper inside transaction  
  const existingCard = await localDb.verseCards.findByUserAndVerse(userId, existingVerse.id!);
  
  // ❌ WRONG: Using localDb wrapper inside transaction
  existingVerse = await localDb.verses.create({...});
});
```

### ❌ dataService.ts - Line 566-584
```typescript
// ❌ WRONG: External DB operations inside transaction
const existingReview = await db.review_logs.where(...).first();
const localLog = await localDb.reviewLogs.create({...}); // Wrapper method!
```

## ✅ Correct Transaction Patterns

### 1. External API Calls BEFORE Transactions

```typescript
// ✅ CORRECT: All external calls BEFORE transaction
const esvResponse = await esvApi.getPassage(reference);
const { data: remoteData } = await supabaseClient.from('verses').select('*');

// Then transaction with ONLY Dexie operations
await db.transaction('rw', db.verses, db.verse_cards, async (tx) => {
  // Pure Dexie operations only
  await tx.verses.add(verseData);
  await tx.verse_cards.add(cardData);
});
```

### 2. Use Transaction Context Directly

```typescript
// ✅ CORRECT: Use transaction parameter (tx)
await db.transaction('rw', db.verses, db.verse_cards, async (tx) => {
  const existing = await tx.verses.where('reference').equals(ref).first();
  if (!existing) {
    await tx.verses.add(newVerse);
  }
  await tx.verse_cards.add(newCard);
});
```

### 3. Prepare Data Before Transaction

```typescript
// ✅ CORRECT: Prepare all data first
const now = new Date().toISOString();
const verseData = {
  id: crypto.randomUUID(),
  reference: canonicalRef,
  text: verseText,
  created_at: now,
  updated_at: now
};

// Then quick transaction
await db.transaction('rw', db.verses, async (tx) => {
  await tx.verses.add(verseData);
});
```

## Recommended Fixes

### 1. Fix addVerse Method

Replace the complex transaction in `dataService.ts` with:

```typescript
async addVerse(reference: string, userId: string) {
  // Step 1: All external API calls BEFORE transaction
  const esvResponse = await esvApi.getPassage(reference);
  const normalizedInput = normalizeReferenceForLookup(reference);
  
  // Step 2: Pre-checks using direct Dexie calls
  let existingVerse = await db.verses.where('[reference+translation]').equals([esvResponse.canonical, 'ESV']).first();
  
  // Step 3: Short, focused transaction
  await db.transaction('rw', db.verses, db.verse_cards, async (tx) => {
    // Only Dexie operations here
    if (!existingVerse) {
      await tx.verses.add(preparedVerseData);
    }
    await tx.verse_cards.add(preparedCardData);
  });
  
  // Step 4: Remote sync AFTER transaction
  await this.syncToRemote(userId);
}
```

### 2. Fix recordReview Method

```typescript
async recordReview(verseCardId: string, userId: string, wasSuccessful: boolean) {
  const todayUTC = new Date().toISOString().split('T')[0];
  let result;
  
  await db.transaction('rw', db.review_logs, async (tx) => {
    // Check for existing review within transaction
    const existing = await tx.review_logs
      .where(['verse_card_id', 'user_id'])
      .equals([verseCardId, userId])
      .filter(log => log.created_at.split('T')[0] === todayUTC)
      .first();
      
    if (existing) {
      throw new Error('Review already recorded today');
    }
    
    // Create new review
    const logData = {
      id: crypto.randomUUID(),
      user_id: userId,
      verse_card_id: verseCardId,
      was_successful: wasSuccessful,
      created_at: new Date().toISOString()
    };
    await tx.review_logs.add(logData);
    result = logData;
  });
  
  return result;
}
```

## Additional Best Practices

### 1. Keep Transactions Short
- Prepare all data before entering transaction
- Only include essential DB operations
- Avoid complex logic inside transactions

### 2. Use Direct Dexie API
```typescript
// ✅ Good
await db.verses.add(data);
await db.verses.where('id').equals(id).first();

// ❌ Avoid in transactions
await localDb.verses.create(data);  // Wrapper method
```

### 3. Separate Concerns
```typescript
// ✅ Good pattern
async function processData() {
  // 1. External API calls
  const apiData = await fetchFromAPI();
  
  // 2. Local transaction
  await db.transaction('rw', db.table, async (tx) => {
    await tx.table.add(processedData);
  });
  
  // 3. Remote sync
  await syncToRemote();
}
```

### 4. Error Handling
```typescript
try {
  await db.transaction('rw', db.verses, async (tx) => {
    // Transaction operations
  });
} catch (error) {
  if (error.name === 'PrematureCommitError') {
    console.error('Transaction was interrupted by external async operation');
    // Handle gracefully
  }
  throw error;
}
```

## Implementation Priority

1. **High**: Fix `dataService.addVerse()` transaction violations
2. **High**: Fix `dataService.recordReview()` transaction violations  
3. **Medium**: Audit all other transaction usage
4. **Low**: Add error handling for PrematureCommitError

## Testing Recommendations

1. Test with slow network conditions to trigger timing issues
2. Test concurrent operations (multiple tabs, rapid clicks)
3. Monitor for PrematureCommitError in production logs
4. Add transaction timeout handling

## References

- [Dexie PrematureCommitError Documentation](https://dexie.org/docs/DexieErrors/Dexie.PrematureCommitError.html)
- [Dexie Transaction Guide](https://dexie.org/docs/Transaction/Transaction)