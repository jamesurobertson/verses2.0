# Batch Sync Requests - Project Resource Package (PRP)

name: "Batch Sync Requests Implementation"
description: |

## Purpose
Comprehensive PRP to implement batched sync operations for improved performance and network efficiency, building on existing dual-write architecture while maintaining offline-first functionality.

## Core Principles
1. **Build on Existing**: Extend current sync patterns rather than rebuild
2. **Maintain Security**: Preserve JWT-based authentication model
3. **Graceful Degradation**: Fall back to individual operations if batching fails
4. **Incremental Enhancement**: Don't break existing individual sync operations
5. **Network Efficiency**: Reduce round trips while maintaining data integrity

---

## Goal
Implement intelligent batching for sync operations to reduce network round trips, improve performance in poor network conditions, and enhance user experience during bulk operations while maintaining the existing dual-write architecture benefits.

## Why
- **Performance**: Reduce network overhead from multiple individual requests
- **Reliability**: Better handling of poor network conditions through reduced round trips
- **User Experience**: Faster bulk operations with progress indicators
- **Scalability**: More efficient resource usage as user data grows

## What
System-level improvement that batches related sync operations into single requests while maintaining all existing functionality, error handling, and security guarantees.

### Success Criteria
- [ ] Multiple operations can be batched into single network requests
- [ ] Partial batch failures handled gracefully with individual operation reporting
- [ ] Improved sync performance for users with multiple verses (≥5 operations)
- [ ] Maintains existing security model and dual-write pattern
- [ ] Falls back to individual operations if batch API unavailable
- [ ] All existing sync functionality preserved
- [ ] Progress indicators for large sync operations

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Current codebase patterns to extend

- file: /projects/verses/src/services/dataService.ts
  why: Core dual-write logic, sync functions, error handling patterns
  pattern: DualWriteResult interface, graceful degradation, timestamp-based incremental sync
  critical: Lines 89-156 contain syncToRemote/syncFromRemote patterns to extend

- file: /projects/verses/src/hooks/useBackgroundSync.ts  
  why: Current background sync hook, simple sync trigger patterns
  pattern: lastSyncRef for incremental sync, network reconnection handling
  critical: Simple implementation ready for batching enhancement

- file: /projects/verses/supabase/functions/verse-operations/index.ts
  why: Current edge function architecture, JWT security, operation patterns
  pattern: Single endpoint with operation type, JWT user extraction, service role operations
  critical: Extend with batch operation type while maintaining security

- file: /projects/verses/src/services/localDb.ts
  why: Database patterns, transaction handling, UUID primary keys
  pattern: Compound indexes, transaction boundaries, change tracking with updated_at
  critical: Database structure supports efficient batch queries

- file: /projects/verses/src/services/supabase.ts
  why: Current network request patterns, timeout handling, client setup
  pattern: AbortController timeouts, typed client operations, error mapping
  critical: HTTP request patterns to extend for batch operations

- file: /projects/verses/src/utils/security.ts
  why: Rate limiting, error handling classes, validation patterns
  pattern: Custom error classes (NetworkError, ValidationError), client-side rate limiting
  critical: Error handling patterns to extend for batch scenarios
```

### Current Codebase Sync Architecture
```bash
src/services/
├── dataService.ts      # EXTEND: Add batch operations alongside existing individual ops
│   ├── syncToRemote()    # Pattern: Individual operation, timestamp-based filtering
│   ├── syncFromRemote()  # Pattern: Incremental sync with error aggregation  
│   └── sync()           # Pattern: Master sync combining both directions
├── localDb.ts          # LEVERAGE: Existing transaction patterns, compound indexes
│   ├── Schema          # Ready: UUID strings, compound indexes for batch queries
│   └── Transactions    # Ready: Atomic operations for batch local writes
└── supabase.ts         # EXTEND: HTTP patterns for batch requests
    ├── Client setup   # Ready: Typed operations, timeout handling
    └── Error handling # Ready: Network error categorization

hooks/
└── useBackgroundSync.ts # ENHANCE: Add batch-aware triggering logic

supabase/functions/
└── verse-operations/   # EXTEND: Add batch operation type
    ├── Security model  # Preserve: JWT extraction, service role operations
    └── Operation types # Extend: 'lookup' | 'create' → add 'batch'
```

### Desired Enhancement Structure
```bash
src/services/
├── dataService.ts           # ENHANCED: Add batch operations
│   ├── batchSyncToRemote()   # NEW: Batch version of individual sync
│   ├── syncQueue            # NEW: Queue for accumulating operations
│   └── intelligentSync()    # NEW: Decides individual vs batch
├── batchSyncService.ts      # NEW: Dedicated batch operation logic
│   ├── BatchOperation       # NEW: Interface for queued operations
│   ├── BatchResult         # NEW: Results with per-operation status
│   └── batchProcessor      # NEW: Queue processor with retry logic
└── localDb.ts              # ENHANCED: Add batch query helpers

supabase/functions/
└── verse-operations/        # ENHANCED: Add batch endpoint
    └── handleBatch()        # NEW: Process multiple operations in single call
```

### Known Gotchas & Implementation Details
```typescript
// CRITICAL: Extend existing DualWriteResult for batch operations
interface BatchSyncResult {
  operations: Array<DualWriteResult<any> & {
    localId: string;        // For client correlation
    operationType: string;   // 'create_verse' | 'record_review' | 'update_profile'
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    errors: Error[];
  };
  batchId: string;          // For debugging and correlation
}

// CRITICAL: Queue structure building on existing patterns
interface QueuedOperation {
  id: string;               // UUID for correlation
  type: 'create_verse' | 'record_review' | 'update_profile';
  data: any;               // Operation-specific data
  localRef: string;        // Reference to local record
  timestamp: string;       // When queued
  retryCount: number;      // Retry tracking
  userId: string;          // From JWT token
}

// CRITICAL: Edge function batch request format
interface BatchRequest {
  operation: 'batch';
  operations: Array<{
    id: string;            // Client-generated correlation ID
    type: 'lookup' | 'create';
    data: any;            // Operation-specific payload
  }>;
  batchId: string;        // Client-generated batch identifier
}

// CRITICAL: Maintain existing security model
// - JWT token passed in Authorization header (existing pattern)  
// - User ID extracted from JWT on server (never trusted from client)
// - Service role operations with RLS (existing pattern)
// - Individual operation validation (same as current)

// CRITICAL: Queue processing strategy
// - Default: Batch operations every 2-3 seconds or 10 operations
// - Network-aware: Larger batches on good connection, smaller on poor
// - Fallback: Individual operations if batch endpoint fails
// - Retry: Exponential backoff for failed batches, individual retry for failed operations

// CRITICAL: Error handling patterns from existing code
// - NetworkError: Connectivity issues, retry entire batch
// - ValidationError: Individual operation issue, retry others
// - DuplicateVerseError: Expected condition, handle gracefully
// - SecurityError: Authentication issue, clear queue and re-authenticate
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// Batch operation queue item
interface QueuedSyncOperation {
  id: string;                    // UUID for correlation  
  type: 'create_verse' | 'record_review' | 'update_profile';
  data: any;                    // Operation payload
  localRef: string;             // Local database reference
  userId: string;               // User context
  queuedAt: string;            // ISO timestamp
  retryCount: number;          // Retry tracking
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Batch processing configuration
interface BatchConfig {
  maxBatchSize: number;        // Default: 10 operations
  batchTimeoutMs: number;      // Default: 3000ms
  maxRetries: number;          // Default: 3 attempts
  networkAwareThrottling: boolean; // Adjust based on connection quality
}

// Enhanced dual-write result for batch operations
interface BatchDualWriteResult {
  batchId: string;
  operations: Array<{
    localId: string;
    operation: QueuedSyncOperation;
    result: DualWriteResult<any>;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    networkErrors: number;
    validationErrors: number;
  };
  processingTimeMs: number;
}
```

### Task List (Implementation Order)

```yaml
Task 1 - Create Batch Data Structures:
MODIFY src/services/dataService.ts:
  - ADD BatchSyncResult, QueuedSyncOperation interfaces  
  - ADD syncQueue array to hold pending operations
  - ADD batchConfig object with default settings
  - PRESERVE all existing individual sync functions

Task 2 - Implement Batch Queue System:
CREATE src/services/batchSyncService.ts:
  - IMPLEMENT queueOperation(type, data, localRef, userId)
  - IMPLEMENT processBatchQueue() with intelligent batching
  - ADD retry logic with exponential backoff
  - ADD network quality detection for adaptive batching

Task 3 - Extend Edge Function for Batch Operations:
MODIFY supabase/functions/verse-operations/index.ts:
  - ADD 'batch' operation type to existing switch statement
  - IMPLEMENT handleBatchOperations() function  
  - PRESERVE existing security model (JWT extraction)
  - ADD individual operation validation within batch

Task 4 - Enhance Local Database for Batch Operations:
MODIFY src/services/localDb.ts:
  - ADD batch query helper functions
  - ADD syncQueue table for persistent queue storage
  - ENHANCE transaction patterns for batch local operations
  - ADD compound indexes for batch query performance

Task 5 - Create Intelligent Sync Decision Logic:
MODIFY src/services/dataService.ts:
  - ADD shouldUseBatchSync() decision function
  - IMPLEMENT intelligentSync() that chooses individual vs batch
  - ADD fallback logic: batch fails → individual operations
  - PRESERVE existing sync() function as fallback

Task 6 - Update Background Sync Hook:
MODIFY src/hooks/useBackgroundSync.ts:
  - ADD batch processing trigger on app foreground
  - ADD queue flush on network reconnection
  - ADD progress tracking for large sync operations
  - PRESERVE simple sync trigger for immediate operations

Task 7 - Add Progress Indicators and User Feedback:
CREATE src/components/BatchSyncProgress/BatchSyncProgress.tsx:
  - DISPLAY batch operation progress
  - SHOW individual operation results
  - HANDLE partial success scenarios
  - PROVIDE retry options for failed operations

Task 8 - Comprehensive Testing:
CREATE tests for batch operations:
  - UNIT: Queue management, batch processing logic
  - INTEGRATION: End-to-end batch sync scenarios  
  - NETWORK: Poor connection handling, retry logic
  - FALLBACK: Individual operation fallback scenarios
```

### Per-Task Detailed Implementation

```typescript
// Task 1: Batch Data Structures in dataService.ts
// ADD to existing dataService.ts (preserve all current functions)
let syncQueue: QueuedSyncOperation[] = [];
const batchConfig: BatchConfig = {
  maxBatchSize: 10,
  batchTimeoutMs: 3000,
  maxRetries: 3,
  networkAwareThrottling: true
};

// Task 2: Batch Queue System
export class BatchSyncService {
  static async queueOperation(
    type: QueuedSyncOperation['type'], 
    data: any, 
    localRef: string, 
    userId: string
  ): Promise<void> {
    const operation: QueuedSyncOperation = {
      id: crypto.randomUUID(),
      type,
      data,
      localRef,
      userId,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending'
    };
    
    // Add to in-memory queue
    syncQueue.push(operation);
    
    // Persist to local database for reliability
    await db.syncQueue.add(operation);
    
    // Trigger processing if queue threshold reached
    if (syncQueue.length >= batchConfig.maxBatchSize) {
      await this.processBatchQueue();
    }
  }

  static async processBatchQueue(): Promise<BatchDualWriteResult> {
    if (syncQueue.length === 0) {
      return this.emptyBatchResult();
    }
    
    const batchId = crypto.randomUUID();
    const operations = syncQueue.splice(0, batchConfig.maxBatchSize);
    
    try {
      // Process batch remotely
      const batchResult = await this.sendBatchRequest(batchId, operations);
      
      // Update local records with results
      await this.updateLocalRecordsFromBatch(batchResult);
      
      return batchResult;
    } catch (error) {
      // Fallback: Process operations individually
      return await this.fallbackToIndividualOperations(operations);
    }
  }
}

// Task 3: Edge Function Enhancement  
// ADD to existing verse-operations/index.ts switch statement
case 'batch':
  return await handleBatchOperations(req);

async function handleBatchOperations(req: Request): Promise<Response> {
  try {
    const { operations, batchId } = await req.json();
    const user = await getUserFromJWT(req); // Existing security function
    
    const results = [];
    for (const op of operations) {
      try {
        // Process each operation using existing handlers
        const result = await processIndividualOperation(op, user.id);
        results.push({ id: op.id, success: true, data: result });
      } catch (error) {
        results.push({ id: op.id, success: false, error: error.message });
      }
    }
    
    return new Response(
      JSON.stringify({
        batchId,
        results,
        summary: {
          total: operations.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Batch processing failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Task 4: Local Database Enhancements
// ADD to existing localDb.ts schema (increment version)
db.version(9).stores({
  // ... existing tables
  syncQueue: '$$id, userId, type, status, queuedAt',  // NEW table for queue persistence
});

// ADD batch helper functions
export const batchHelpers = {
  async getUnverifiedVersesByUser(userId: string, limit = 50): Promise<LocalVerse[]> {
    return db.verses
      .where('[user_id+is_verified]')
      .equals([userId, false])
      .limit(limit)
      .toArray();
  },
  
  async markVersesBatchAsVerified(verseIds: string[]): Promise<void> {
    await db.transaction('rw', db.verses, async () => {
      for (const id of verseIds) {
        await db.verses.update(id, { 
          is_verified: true, 
          updated_at: new Date().toISOString() 
        });
      }
    });
  }
};

// Task 5: Intelligent Sync Decision Logic
export async function intelligentSync(
  userId: string, 
  lastSyncTimestamp?: string
): Promise<BatchDualWriteResult | ReturnType<typeof sync>> {
  // Check queue size and network conditions
  const queueSize = syncQueue.filter(op => op.userId === userId).length;
  const networkQuality = await estimateNetworkQuality();
  
  if (shouldUseBatchSync(queueSize, networkQuality)) {
    try {
      return await BatchSyncService.processBatchQueue();
    } catch (error) {
      console.warn('Batch sync failed, falling back to individual operations');
      return await sync(userId, lastSyncTimestamp); // Existing function
    }
  } else {
    return await sync(userId, lastSyncTimestamp); // Existing individual sync
  }
}

function shouldUseBatchSync(queueSize: number, networkQuality: 'good' | 'fair' | 'poor'): boolean {
  // Use batch for multiple operations or poor network conditions
  return queueSize >= 3 || (queueSize >= 1 && networkQuality === 'poor');
}
```

### Integration Points
```yaml
EDGE_FUNCTIONS:
  - extend: "verse-operations with batch operation type"
  - preserve: "JWT security model, service role operations"
  - add: "batch operation validation and processing"

DATABASE:
  - extend: "localDb with syncQueue table and batch helpers"
  - preserve: "existing transaction patterns and indexes"  
  - add: "compound indexes for batch query performance"

HOOKS:
  - enhance: "useBackgroundSync with batch processing triggers"
  - preserve: "simple sync for immediate operations"
  - add: "progress tracking for batch operations"

SERVICES:  
  - extend: "dataService with batch operation queue and processing"
  - preserve: "all existing individual sync functions"
  - add: "intelligent sync decision logic with fallback"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                    # ESLint checks
npm run type-check             # TypeScript compilation

# Expected: No errors. If errors exist, read error messages and fix before proceeding
```

### Level 2: Unit Tests
```typescript
// CREATE tests/services/batchSyncService.test.ts
describe('BatchSyncService', () => {
  beforeEach(async () => {
    await clearSyncQueue();
    jest.clearAllMocks();
  });

  test('queues operations correctly', async () => {
    await BatchSyncService.queueOperation(
      'create_verse',
      { reference: 'John 3:16', text: 'For God so loved...' },
      'local-ref-123',
      'user-123'
    );
    
    const queue = await getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('create_verse');
    expect(queue[0].userId).toBe('user-123');
  });

  test('processes batch when queue reaches threshold', async () => {
    const processBatchSpy = jest.spyOn(BatchSyncService, 'processBatchQueue');
    
    // Add operations up to batch size
    for (let i = 0; i < 10; i++) {
      await BatchSyncService.queueOperation(
        'create_verse',
        { reference: `Test ${i}:1` },
        `local-${i}`,
        'user-123'
      );
    }
    
    expect(processBatchSpy).toHaveBeenCalledTimes(1);
  });

  test('handles partial batch failures gracefully', async () => {
    // Mock edge function to fail some operations
    mockBatchEndpoint.mockResolvedValueOnce({
      results: [
        { id: 'op-1', success: true, data: {} },
        { id: 'op-2', success: false, error: 'Validation failed' },
        { id: 'op-3', success: true, data: {} }
      ]
    });
    
    const result = await BatchSyncService.processBatchQueue();
    
    expect(result.summary.successful).toBe(2);
    expect(result.summary.failed).toBe(1);
  });

  test('falls back to individual operations on batch failure', async () => {
    mockBatchEndpoint.mockRejectedValueOnce(new Error('Network error'));
    const individualSyncSpy = jest.spyOn(dataService, 'sync');
    
    await BatchSyncService.processBatchQueue();
    
    expect(individualSyncSpy).toHaveBeenCalled();
  });
});

// CREATE tests/services/dataService.test.ts (additions to existing file)
describe('Intelligent Sync', () => {
  test('chooses batch sync for multiple operations', async () => {
    // Queue multiple operations
    await queueMultipleOperations('user-123', 5);
    
    const batchSyncSpy = jest.spyOn(BatchSyncService, 'processBatchQueue');
    const individualSyncSpy = jest.spyOn(dataService, 'sync');
    
    await intelligentSync('user-123');
    
    expect(batchSyncSpy).toHaveBeenCalled();
    expect(individualSyncSpy).not.toHaveBeenCalled();
  });

  test('chooses individual sync for single operation on good network', async () => {
    mockNetworkQuality('good');
    await queueSingleOperation('user-123');
    
    const result = await intelligentSync('user-123');
    
    expect(result).toHaveProperty('toRemote'); // Individual sync result structure
  });

  test('falls back to individual sync when batch fails', async () => {
    mockBatchEndpoint.mockRejectedValue(new Error('Batch unavailable'));
    await queueMultipleOperations('user-123', 3);
    
    const result = await intelligentSync('user-123');
    
    expect(result).toHaveProperty('toRemote'); // Fallback to individual sync
  });
});
```

```bash
# Run and iterate until passing:
npm test -- batchSyncService.test.ts
npm test -- dataService.test.ts
# If tests fail: Read error messages, fix root cause, re-run
```

### Level 3: Integration Test
```bash
# Start development server with edge functions
npm run dev

# Test batch operations in browser console:
# 1. Queue multiple operations
await BatchSyncService.queueOperation('create_verse', {reference: 'Test 1:1'}, 'local-1', 'user-123');
await BatchSyncService.queueOperation('create_verse', {reference: 'Test 1:2'}, 'local-2', 'user-123');

# 2. Process batch
const result = await BatchSyncService.processBatchQueue();
console.log('Batch result:', result);

# 3. Verify network requests
# Check Network tab for single batch request instead of multiple individual requests

# Expected: Single POST to /functions/v1/verse-operations with operation: 'batch'
```

### Level 4: Edge Function Testing
```bash
# Test edge function batch endpoint
curl -X POST "http://localhost:54321/functions/v1/verse-operations" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "batch",
    "batchId": "test-batch-123",
    "operations": [
      {
        "id": "op-1",
        "type": "create",
        "data": {"reference": "Test 1:1", "text": "Test verse"}
      },
      {
        "id": "op-2", 
        "type": "lookup",
        "data": {"reference": "John 3:16"}
      }
    ]
  }'

# Expected: Batch response with individual operation results
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run type-check`
- [ ] Batch operations reduce network requests (check Network tab)
- [ ] Partial failures handled gracefully with individual operation status
- [ ] Fallback to individual operations works when batch fails
- [ ] Progress indicators show during large sync operations
- [ ] Existing individual sync operations continue to work unchanged
- [ ] Queue persists across app restarts (stored in IndexedDB)
- [ ] Network-aware batching adapts to connection quality
- [ ] Security model preserved (JWT authentication, RLS policies)

---

## Anti-Patterns to Avoid
- ❌ Don't break existing individual sync operations - maintain backward compatibility
- ❌ Don't bypass existing security model - preserve JWT authentication
- ❌ Don't ignore partial failures - handle each operation result individually
- ❌ Don't create synchronous batch operations - maintain async patterns
- ❌ Don't skip fallback logic - always provide individual operation fallback
- ❌ Don't hardcode batch sizes - make them configurable and network-aware
- ❌ Don't queue operations indefinitely - implement queue size limits and expiration

## Performance Considerations
- ✅ Network-aware batch sizing based on connection quality
- ✅ Queue processing with configurable timeouts and thresholds  
- ✅ Exponential backoff for retry logic
- ✅ Local queue persistence to survive app restarts
- ✅ Progress tracking for user feedback during large operations
- ✅ Graceful degradation when batch processing unavailable
- ✅ Compound database indexes for efficient batch queries

**Confidence Score: 9/10** - Very high confidence due to comprehensive analysis of existing patterns, detailed implementation plan building directly on current architecture, extensive validation gates, and fallback strategies that preserve all existing functionality.