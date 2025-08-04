# Data Integrity Strategy - Preventing Duplicate Verses

## Database Constraints

### Remote (Supabase/PostgreSQL)
```sql
UNIQUE(reference, translation)  -- Prevents duplicate verses
```

### Local (Dexie/IndexedDB)
```javascript
[reference+translation]  // Compound index provides uniqueness
```

## Implementation Strategy

### 1. ✅ Use UPSERT for Remote Operations
Instead of SELECT + INSERT, we use `upsert()` which leverages the database constraint:

```typescript
// ✅ GOOD: Atomic operation, handles duplicates gracefully
const { data: verse } = await supabaseClient
  .from('verses')
  .upsert({
    reference: 'John 3:16',
    text: 'For God so loved...',
    translation: 'ESV',
    aliases: ['jn 3:16']
  }, {
    onConflict: 'reference,translation',
    ignoreDuplicates: false  // Update if exists
  })
  .select()
  .single();

// ❌ BAD: Race condition possible between SELECT and INSERT
const existing = await supabaseClient.from('verses').select().eq('reference', ref).single();
if (!existing) {
  await supabaseClient.from('verses').insert(data);
}
```

### 2. ✅ Handle Local Constraint Violations
For Dexie, we use try/catch around `.add()` operations:

```typescript
try {
  await tx.verses.add(verseData);
} catch (error) {
  if (error.name === 'ConstraintError') {
    // Another operation created this verse, fetch it
    const existing = await tx.verses.where('[reference+translation]').equals([ref, 'ESV']).first();
    return existing;
  }
  throw error;
}
```

### 3. ✅ Pre-flight Checks for User Experience
Before starting expensive operations, check for obvious duplicates:

```typescript
// Check if user already has this verse
const existingCard = await localDb.verseCards.findByUserAndVerse(userId, verseId);
if (existingCard) {
  throw new DuplicateVerseError('You already have this verse in your collection');
}
```

## Benefits of This Approach

### 🔒 **Data Integrity**
- Database constraints prevent duplicates at the storage level
- No duplicate verses possible even with concurrent operations
- Consistent data across local and remote databases

### 🚀 **Performance**
- `UPSERT` is atomic - single database round trip
- No race conditions between SELECT and INSERT
- Handles concurrent users gracefully

### 🛡️ **Reliability** 
- Works even if multiple browser tabs are open
- Handles network interruptions gracefully
- Automatic conflict resolution

### 👤 **User Experience**
- Clear error messages for user-facing duplicates
- Prevents accidental duplicate additions
- Maintains data consistency across devices

## Edge Cases Handled

1. **Concurrent Operations**: Two browser tabs trying to add the same verse
2. **Network Interruptions**: Partial sync scenarios
3. **Race Conditions**: Multiple async operations on the same data
4. **Sync Conflicts**: Different devices adding the same verse offline

## Migration Notes

If existing data has duplicates, run a cleanup migration:

```sql
-- Remove duplicate verses (keep the first one)
DELETE FROM verses a USING verses b 
WHERE a.id > b.id 
AND a.reference = b.reference 
AND a.translation = b.translation;
```

## Testing Strategy

1. **Unit Tests**: Test constraint violation handling
2. **Integration Tests**: Test concurrent operations
3. **End-to-End Tests**: Test multi-device sync scenarios
4. **Manual Testing**: Test with multiple browser tabs open