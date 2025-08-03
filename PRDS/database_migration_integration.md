# Database Migration Integration PRD

## **Executive Summary**

The new database migration introduces significant schema and behavioral changes that require comprehensive updates across the frontend application. The current codebase has **critical incompatibilities** that will break functionality if not addressed. 

*** IMPORTANT FIX, DO NOT WORRY ABOUT BACKWRADS COMPATABILITY. THIS IS GREENFIELD AND NOBODY IS USING APP YET.

## **🚨 Critical Issues Identified**

### **1. Schema Mismatches (BLOCKING)**

#### **Local Database Schema Outdated**
- ❌ **Missing `timezone`** in `user_profiles` 
- ❌ **Missing assignment columns** in `verse_cards`:
  - `assigned_day_of_week`
  - `assigned_week_parity` 
  - `assigned_day_of_month`
- ❌ **Missing `aliases`** in `verses`
- ❌ **Schema version** needs increment

#### **TypeScript Types Out of Sync**
- ❌ **supabase.ts types** don't match new schema
- ❌ **Interface mismatches** between local/remote
- ❌ **No type safety** for new fields

### **2. Due Card Logic Incompatibility (BREAKING)**

#### **Frontend Uses Simple Date Logic**
```typescript
// Current (WRONG)
card.next_due_date <= today && !card.archived

// Migration Expects (CORRECT) 
// Assignment-based logic with timezone awareness
```

#### **Missing Assignment System Integration**
- ❌ **useReview** doesn't understand weekly/biweekly assignments
- ❌ **useLibrary** due count calculation is wrong
- ❌ **No timezone awareness** in frontend

### **3. Timezone Integration Missing (BREAKING)**

#### **No Frontend Timezone Capture**
- ❌ **Signup** doesn't capture user timezone
- ❌ **All date operations** use local device time
- ❌ **No timezone context** in hooks

#### **Backend Expects Timezone-Aware Operations**
- ✅ **Migration** requires timezone for all date calculations
- ✅ **Due card view** uses timezone-aware logic
- ❌ **Frontend** provides no timezone context

### **4. Race Condition Protection Conflicts (BREAKING)**

#### **New Unique Constraint**
```sql
-- Migration adds:
CREATE UNIQUE INDEX idx_one_review_per_card_per_day 
    ON review_logs(verse_card_id, user_id, date(created_at AT TIME ZONE 'UTC'));
```

#### **Frontend Allows Multiple Reviews**
- ❌ **useReview** can create duplicate reviews per day
- ❌ **Local DB** has no constraint enforcement
- ❌ **Syncing** will fail on constraint violations

### **5. Syncing Architecture Breakdown (CRITICAL)**

#### **ID Type Mismatches**
- 🔴 **Local DB**: Auto-increment integers (`id: number`)
- 🔴 **Remote DB**: UUIDs (`id: string`)
- 🔴 **DataService**: Expects number IDs

#### **Field Mapping Issues**
- ❌ **Assignment fields** will be NULL when syncing
- ❌ **Aliases array** not handled in sync
- ❌ **Timezone** not available for calculations

## **📋 Required Changes**

### **Phase 1: Schema Updates (HIGH PRIORITY)**

#### **1.1 Update Local Database Schema**
```typescript
// localDb.ts updates needed
export interface LocalDBSchema {
  verses: {
    // ... existing fields
    aliases: string[];  // ADD
  };
  
  verse_cards: {
    // ... existing fields  
    assigned_day_of_week: number | null;    // ADD
    assigned_week_parity: number | null;    // ADD  
    assigned_day_of_month: number | null;   // ADD
  };
  
  user_profiles: {  // ADD ENTIRE TABLE
    id?: number;
    user_id: string;
    email: string | null;
    full_name: string | null;
    timezone: string;
    preferred_translation: string;
    reference_display_mode: string;
    created_at: string;
    updated_at: string;
  };
}
```

#### **1.2 Update Supabase Types**
```typescript
// supabase.ts updates needed
user_profiles: {
  Row: {
    // ... existing fields
    timezone: string;  // ADD
  };
};

verse_cards: {
  Row: {
    // ... existing fields
    assigned_day_of_week: number | null;    // ADD
    assigned_week_parity: number | null;    // ADD
    assigned_day_of_month: number | null;   // ADD
  };
};

verses: {
  Row: {
    // ... existing fields
    aliases: string[];  // ADD
  };
};
```

#### **1.3 Increment Database Version**
```typescript
// localDb.ts
db.version(9).stores({  // Increment from 8 to 9
  // Add user_profiles table
  user_profiles: '++id, user_id, timezone, [user_id]',
  // Update existing stores with new indexes
  verse_cards: '++id, user_id, verse_id, next_due_date, current_phase, archived, assigned_day_of_week, assigned_week_parity, assigned_day_of_month, [user_id+verse_id]'
});
```

### **Phase 2: Due Card Logic Overhaul (HIGH PRIORITY)**

#### **2.1 Replace Simple Date Logic**
```typescript
// REMOVE from useLibrary.ts
const dueCount = verses.filter(verse => {
  const today = getTodayString();
  return verse.nextDueDate <= today && !verse.archived;
}).length;

// REPLACE with assignment-aware logic
const dueCount = verses.filter(verse => {
  if (verse.archived) return false;
  
  const userToday = getUserTodayInTimezone(userTimezone);
  const userDOW = userToday.getDay();
  const userDOM = userToday.getDate();
  const userWeekParity = getWeekParityFromDate(userToday);
  
  switch (verse.currentPhase) {
    case 'daily': return true;
    case 'weekly': return verse.assignedDayOfWeek === userDOW;
    case 'biweekly': 
      return verse.assignedDayOfWeek === userDOW && 
             verse.assignedWeekParity === userWeekParity;
    case 'monthly': 
      return verse.assignedDayOfMonth === userDOM && userDOM <= 28;
    default: return false;
  }
}).length;
```

#### **2.2 Update Interface Definitions**
```typescript
// Update LibraryVerseCard interface
export interface LibraryVerseCard {
  // ... existing fields
  assignedDayOfWeek: number | null;    // ADD
  assignedWeekParity: number | null;   // ADD
  assignedDayOfMonth: number | null;   // ADD
}
```

### **Phase 3: Timezone Integration (HIGH PRIORITY)**

#### **3.1 Capture Timezone on Signup**
```typescript
// In signup flow
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: name,
      timezone: userTimezone  // ADD
    }
  }
});
```

#### **3.2 Add Timezone Context**
```typescript
// Create new context
export const TimezoneContext = createContext<{
  timezone: string;
  userToday: Date;
  getUserDate: (date: Date) => Date;
}>({
  timezone: 'UTC',
  userToday: new Date(),
  getUserDate: (date) => date
});
```

#### **3.3 Update All Date Operations**
- Replace all `new Date()` calls with timezone-aware equivalents
- Update due card calculations
- Fix "today" logic throughout app

### **Phase 4: Race Condition Handling (MEDIUM PRIORITY)**

#### **4.1 Add Local Constraint Checking**
```typescript
// In dataService.recordReview()
const existingReviewToday = await localDb.reviewLogs
  .where(['verse_card_id', 'user_id'])
  .equals([verseCardId, userId])
  .filter(log => {
    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    const todayUTC = new Date().toISOString().split('T')[0];
    return logDate === todayUTC;
  })
  .first();

if (existingReviewToday) {
  throw new Error('Card already reviewed today');
}
```

#### **4.2 Update UI to Show Review Status**
- Show "Already reviewed today" state
- Disable review buttons for completed cards
- Add review history to card display

### **Phase 5: ID Strategy Resolution (HIGH PRIORITY)**

#### **5.1 Option A: Use UUIDs in Local DB**
```typescript
// Update localDb.ts to use UUIDs
import { v4 as uuidv4 } from 'uuid';

// Change all ++id to use UUID generation
verses: 'id, reference, translation, *aliases, [reference+translation]'

// Add UUID generation in hooks
db.verses.hook('creating', function (_primKey, obj, _trans) {
  obj.id = obj.id || uuidv4();
  // ... rest of hook
});
```

#### **5.2 Option B: ID Mapping Strategy**
```typescript
// Add ID mapping table
id_mappings: {
  local_id: number;
  remote_id: string;
  table_name: string;
  synced_at: string;
}
```

### **Phase 6: Enhanced Syncing (MEDIUM PRIORITY)**

#### **6.1 Assignment Field Syncing**
```typescript
// Update dataService sync logic
await supabaseDb.verseCards.create({
  // ... existing fields
  assigned_day_of_week: localCard.assigned_day_of_week,
  assigned_week_parity: localCard.assigned_week_parity,  
  assigned_day_of_month: localCard.assigned_day_of_month
});
```

#### **6.2 Timezone-Aware Syncing**
```typescript
// Pass user timezone to all sync operations
const userProfile = await localDb.userProfiles.getByUserId(userId);
const timezone = userProfile?.timezone || 'UTC';

// Use timezone in all date calculations during sync
```

## **🚀 Implementation Priority**

### **Week 1: Critical Schema Updates**
1. ✅ Update local database schema
2. ✅ Update TypeScript types
3. ✅ Fix immediate breaking changes

### **Week 2: Due Card Logic**
1. ✅ Implement assignment-aware due card detection
2. ✅ Update all hooks to use new logic
3. ✅ Add timezone integration

### **Week 3: ID Strategy & Syncing**
1. ✅ Resolve ID type mismatches
2. ✅ Update syncing logic for new fields
3. ✅ Add constraint handling

### **Week 4: Polish & Testing**
1. ✅ Comprehensive testing of all flows
2. ✅ Performance optimization
3. ✅ Error handling improvements

## **⚠️ Risks & Mitigation**

### **Data Loss Risk**
- **Risk**: Schema migration could lose user data
- **Mitigation**: Backup local database before migration

### **Sync Conflicts**
- **Risk**: Existing local data incompatible with new schema  
- **Mitigation**: Migration script to populate new fields with defaults

### **User Experience**
- **Risk**: Complex timezone handling confuses users
- **Mitigation**: Automatic timezone detection with manual override

## **✅ Success Criteria**

1. **Schema Compatibility**: Local and remote databases match perfectly
2. **Assignment System**: Cards appear on correct days based on user timezone
3. **Race Condition Prevention**: No duplicate reviews possible
4. **Smooth Syncing**: All data syncs correctly with new fields
5. **Timezone Accuracy**: Users see reviews at correct local times

## **📊 Estimated Effort**

- **Development**: 3-4 weeks (1 developer)
- **Testing**: 1 week
- **Migration Planning**: 3 days
- **Total**: ~5 weeks

This is a **significant undertaking** requiring careful planning and execution to avoid breaking the application.
