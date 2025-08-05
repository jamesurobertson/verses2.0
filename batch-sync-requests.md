# Batch Sync Requests Implementation

## Overview

This document outlines the implementation of batch sync requests for Verses 2.0, designed to dramatically improve sync performance while maintaining the local-first architecture and graceful degradation principles.

## Current State Analysis

### Problems with Current Sync Pattern
- **Network overhead**: Each operation makes separate API calls
- **Battery drain**: Frequent network requests impact mobile battery life
- **Race conditions**: Multiple simultaneous sync operations can conflict
- **Poor offline experience**: Individual network failures create user friction
- **API rate limiting**: Risk of hitting ESV API or Supabase rate limits
- **Inefficient bulk operations**: Adding multiple verses feels slow

### Current Dual-Write Pattern
```typescript
// Local operation first (immediate)
await db.transaction('rw', [tables], async (tx) => {
  // All local changes in transaction
});

// Remote sync (immediate, can fail gracefully)
try {
  await syncToRemote(data);
} catch (error) {
  // Log error but don't fail - local succeeded
}
```

## Batch Sync Architecture

### Core Principles
1. **Maintain local-first**: Local operations never blocked by batching
2. **Graceful degradation**: Batch failures don't affect local state
3. **Intelligent batching**: Adapt batch size/timing to network conditions
4. **Priority handling**: Critical operations can bypass batching
5. **Conflict resolution**: Handle remote state changes elegantly

### New Dual-Write Pattern
```typescript
// Local operation first (unchanged)
const localResult = await db.transaction('rw', [tables], async (tx) => {
  // All local changes in transaction
});

// Queue for batch sync (non-blocking)
await batchSyncService.queueOperation({
  type: 'CREATE_VERSE',
  payload: { reference, customText },
  priority: 'normal',
  localRecordId: localResult.id
});

return localResult; // Immediate return
```

## Implementation Details

### 1. Data Structures

#### Sync Operation Schema
```typescript
interface SyncOperation {
  id: string;                    // Unique operation ID
  type: OperationType;           // Type of operation to sync
  payload: any;                  // Operation-specific data
  timestamp: number;             // When operation was queued
  priority: 'immediate' | 'high' | 'normal' | 'low';
  retryCount: number;            // Current retry attempt
  maxRetries: number;            // Maximum retry attempts
  localRecordId?: string;        // Link to local record
  userId?: string;               // User context (for offline operations)
}

type OperationType = 
  | 'CREATE_VERSE'
  | 'RECORD_REVIEW' 
  | 'UPDATE_PROFILE'
  | 'CREATE_ALIAS'
  | 'DELETE_VERSE';

interface SyncBatch {
  id: string;
  operations: SyncOperation[];
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'partial';
  createdAt: number;
  syncedAt?: number;
  errorMessage?: string;
  successCount: number;
  failureCount: number;
}
```

#### Queue Storage Schema (Dexie.js)
```typescript
// Add to localDb.ts schema
export interface SyncQueueSchema {
  syncOperations: {
    key: string;
    value: SyncOperation;
    indexes: {
      'type': string;
      'priority': string;
      'timestamp': number;
      'userId': string;
    };
  };
  syncBatches: {
    key: string;
    value: SyncBatch;
    indexes: {
      'status': string;
      'createdAt': number;
    };
  };
}
```

### 2. BatchSyncService Implementation

```typescript
export class BatchSyncService {
  private queue: SyncOperation[] = [];
  private currentBatch: SyncBatch | null = null;
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  
  // Dynamic configuration based on network conditions
  private config = {
    batchSize: 10,
    batchTimeout: 5000, // ms
    maxRetries: 3,
    retryBackoff: 1000  // ms
  };

  constructor(
    private networkManager: NetworkStateManager,
    private supabaseClient: SupabaseClient
  ) {
    this.initializeFromPersistedQueue();
    this.setupNetworkListeners();
    this.startPeriodicSync();
  }

  /**
   * Queue an operation for batch sync
   */
  async queueOperation(op: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const operation: SyncOperation = {
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0
    };

    // Handle immediate priority operations
    if (op.priority === 'immediate') {
      await this.syncOperationImmediately(operation);
      return;
    }

    // Add to queue
    this.queue.push(operation);
    await this.persistOperation(operation);

    // Check if we should batch immediately
    if (this.shouldCreateBatch()) {
      await this.processBatch();
    } else {
      this.scheduleBatchTimeout();
    }
  }

  /**
   * Process current queue into a batch and sync
   */
  async processBatch(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    if (!this.networkManager.isOnline()) return;

    this.isProcessing = true;
    this.clearBatchTimeout();

    try {
      const batch = await this.createBatch();
      await this.syncBatchToRemote(batch);
      await this.handleBatchSuccess(batch);
    } catch (error) {
      console.error('Batch processing failed:', error);
      await this.handleBatchFailure(error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry failed batches with exponential backoff
   */
  async retryFailedBatches(): Promise<void> {
    if (!this.networkManager.isOnline()) return;

    const failedBatches = await this.getFailedBatches();
    
    for (const batch of failedBatches) {
      const retryDelay = this.calculateRetryDelay(batch.operations[0]?.retryCount || 0);
      
      setTimeout(async () => {
        try {
          await this.syncBatchToRemote(batch);
          await this.handleBatchSuccess(batch);
        } catch (error) {
          await this.handleBatchFailure(error, batch);
        }
      }, retryDelay);
    }
  }

  /**
   * Force sync of all pending operations (user-initiated)
   */
  async forceSyncAll(): Promise<{ success: number; failed: number }> {
    if (!this.networkManager.isOnline()) {
      throw new Error('Cannot sync while offline');
    }

    // Process current queue
    await this.processBatch();
    
    // Retry all failed batches
    await this.retryFailedBatches();
    
    // Return summary
    return this.getSyncSummary();
  }

  private async createBatch(): SyncBatch {
    const config = this.networkManager.getBatchConfig();
    const operations = this.queue.splice(0, config.size);
    
    const batch: SyncBatch = {
      id: crypto.randomUUID(),
      operations,
      status: 'pending',
      createdAt: Date.now(),
      successCount: 0,
      failureCount: 0
    };

    await this.persistBatch(batch);
    return batch;
  }

  private async syncBatchToRemote(batch: SyncBatch): Promise<void> {
    batch.status = 'syncing';
    await this.persistBatch(batch);

    // Group operations by type for efficient processing
    const groupedOps = this.groupOperationsByType(batch.operations);
    
    const results = await Promise.allSettled(
      Object.entries(groupedOps).map(([type, ops]) => 
        this.syncOperationGroup(type as OperationType, ops)
      )
    );

    // Process results
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount += result.value.successCount;
        failureCount += result.value.failureCount;
      } else {
        failureCount += Object.values(groupedOps)[index].length;
        errors.push(result.reason.message);
      }
    });

    batch.successCount = successCount;
    batch.failureCount = failureCount;
    batch.status = failureCount === 0 ? 'completed' : 
                   successCount === 0 ? 'failed' : 'partial';
    batch.syncedAt = Date.now();
    
    if (errors.length > 0) {
      batch.errorMessage = errors.join('; ');
    }

    await this.persistBatch(batch);
  }

  private async syncOperationGroup(
    type: OperationType, 
    operations: SyncOperation[]
  ): Promise<{ successCount: number; failureCount: number }> {
    
    switch (type) {
      case 'CREATE_VERSE':
        return this.syncVerseCreations(operations);
      case 'RECORD_REVIEW':
        return this.syncReviewRecords(operations);
      case 'UPDATE_PROFILE':
        return this.syncProfileUpdates(operations);
      case 'CREATE_ALIAS':
        return this.syncAliasCreations(operations);
      case 'DELETE_VERSE':
        return this.syncVerseDeletions(operations);
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  private async syncVerseCreations(operations: SyncOperation[]): Promise<{ successCount: number; failureCount: number }> {
    // Batch call to verse-operations edge function
    const { data, error } = await this.supabaseClient.functions.invoke('verse-operations', {
      body: {
        action: 'batch_create_verses',
        operations: operations.map(op => ({
          id: op.id,
          reference: op.payload.reference,
          customText: op.payload.customText,
          localRecordId: op.localRecordId
        }))
      }
    });

    if (error) throw error;

    // Update local records with remote IDs
    await this.updateLocalRecordsWithRemoteIds(data.results);

    return {
      successCount: data.results.filter(r => r.success).length,
      failureCount: data.results.filter(r => !r.success).length
    };
  }

  private shouldCreateBatch(): boolean {
    const config = this.networkManager.getBatchConfig();
    return this.queue.length >= config.size;
  }

  private scheduleBatchTimeout(): void {
    if (this.batchTimer) return; // Already scheduled
    
    const config = this.networkManager.getBatchConfig();
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, config.timeout);
  }

  private clearBatchTimeout(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}
```

### 3. Network State Management

```typescript
export class NetworkStateManager {
  private isOnlineState: boolean = navigator.onLine;
  private connectionQuality: 'poor' | 'good' | 'excellent' = 'good';
  private listeners: Array<(online: boolean) => void> = [];

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    this.detectConnectionQuality();
  }

  isOnline(): boolean {
    return this.isOnlineState;
  }

  getBatchConfig(): { size: number; timeout: number } {
    if (!this.isOnlineState) return { size: 0, timeout: 0 };
    
    // Adapt batch configuration to connection quality
    switch (this.connectionQuality) {
      case 'poor': 
        return { size: 3, timeout: 15000 }; // Small batches, longer timeout
      case 'good': 
        return { size: 10, timeout: 5000 };   // Default configuration
      case 'excellent': 
        return { size: 20, timeout: 2000 };   // Large batches, quick timeout
    }
  }

  private handleOnline(): void {
    this.isOnlineState = true;
    this.notifyListeners(true);
  }

  private handleOffline(): void {
    this.isOnlineState = false;
    this.notifyListeners(false);
  }

  private async detectConnectionQuality(): Promise<void> {
    if (!this.isOnlineState) return;

    // Simple connection speed test
    const startTime = performance.now();
    try {
      await fetch('/favicon.ico', { cache: 'no-cache' });
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      if (latency < 100) {
        this.connectionQuality = 'excellent';
      } else if (latency < 500) {
        this.connectionQuality = 'good';
      } else {
        this.connectionQuality = 'poor';
      }
    } catch {
      this.connectionQuality = 'poor';
    }
  }
}
```

### 4. Edge Function Updates

Create new batch endpoints in `verse-operations` edge function:

```typescript
// supabase/functions/verse-operations/index.ts

export async function batchCreateVerses(
  operations: Array<{
    id: string;
    reference: string;
    customText?: string;
    localRecordId: string;
  }>,
  userId: string
): Promise<{ results: Array<{ id: string; success: boolean; remoteId?: string; error?: string }> }> {
  
  const results = [];
  
  // Process operations in transaction for consistency
  const { data, error } = await supabase.rpc('rpc_batch_create_verses', {
    p_operations: operations.map(op => ({
      operation_id: op.id,
      reference: op.reference,
      custom_text: op.customText,
      local_record_id: op.localRecordId,
      user_id: userId
    }))
  });

  if (error) {
    // Return individual failures for each operation
    return {
      results: operations.map(op => ({
        id: op.id,
        success: false,
        error: error.message
      }))
    };
  }

  return { results: data };
}
```

### 5. Integration with Existing Services

Update `dataService.ts` to use batch sync:

```typescript
// src/services/dataService.ts

import { batchSyncService } from './batchSyncService';

export async function addVerseCard(reference: string, customText?: string): Promise<VerseCard> {
  // 1. Local operation (unchanged for immediate user feedback)
  const localResult = await db.transaction('rw', [db.verseCards, db.verses], async (tx) => {
    // ... existing local logic
    return newVerseCard;
  });

  // 2. Queue for batch sync (non-blocking)
  try {
    await batchSyncService.queueOperation({
      type: 'CREATE_VERSE',
      payload: { 
        reference, 
        customText,
        userId: await getCurrentUserId() // Handle offline case
      },
      priority: 'normal',
      maxRetries: 3,
      localRecordId: localResult.id
    });
  } catch (error) {
    console.warn('Failed to queue sync operation:', error);
    // Local operation still succeeded
  }

  return localResult;
}

export async function recordReview(verseCardId: string, correct: boolean): Promise<ReviewLog> {
  // 1. Local operation first
  const localReview = await db.transaction('rw', [db.reviewLogs, db.verseCards], async (tx) => {
    // ... existing logic
    return newReview;
  });

  // 2. Queue for batch sync
  await batchSyncService.queueOperation({
    type: 'RECORD_REVIEW',
    payload: {
      verseCardId,
      correct,
      reviewDate: localReview.reviewDate,
      userId: await getCurrentUserId()
    },
    priority: 'high', // Reviews are important for progress tracking
    maxRetries: 5,
    localRecordId: localReview.id
  });

  return localReview;
}
```

### 6. User Interface Integration

Add sync status indicators and manual sync controls:

```typescript
// src/components/SyncStatus.tsx

export function SyncStatus() {
  const [syncState, setSyncState] = useState<{
    pending: number;
    syncing: boolean;
    lastSync?: Date;
  }>({ pending: 0, syncing: false });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Subscribe to batch sync service events
    const unsubscribe = batchSyncService.subscribe((state) => {
      setSyncState(state);
    });

    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    try {
      await batchSyncService.forceSyncAll();
    } catch (error) {
      // Show error to user
    }
  };

  return (
    <div className="sync-status">
      {!isOnline && (
        <div className="offline-indicator">
          📴 Offline - changes will sync when online
        </div>
      )}
      
      {syncState.pending > 0 && (
        <div className="pending-sync">
          {syncState.pending} changes pending sync
          <button onClick={handleManualSync} disabled={!isOnline || syncState.syncing}>
            {syncState.syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}
      
      {syncState.lastSync && (
        <div className="last-sync">
          Last synced: {formatDistanceToNow(syncState.lastSync)} ago
        </div>
      )}
    </div>
  );
}
```

## Migration Strategy

### Phase 1: Foundation (Week 1)
- [ ] Implement `BatchSyncService` core functionality
- [ ] Add sync queue tables to local database schema
- [ ] Create basic network state management
- [ ] Update one operation type (verse creation) to use batching

### Phase 2: Core Features (Week 2)
- [ ] Implement all operation types in batch sync
- [ ] Add retry logic with exponential backoff
- [ ] Create batch endpoints in edge functions
- [ ] Add basic UI sync indicators

### Phase 3: Intelligence (Week 3)
- [ ] Implement network-aware batching strategies
- [ ] Add conflict resolution for edge cases
- [ ] Implement priority-based operation handling
- [ ] Add comprehensive error handling and logging

### Phase 4: Polish (Week 4)
- [ ] Add manual sync controls for users
- [ ] Implement sync analytics and monitoring
- [ ] Add offline/online transition handling
- [ ] Performance optimization and testing

## Testing Strategy

### Unit Tests
- Batch creation and queuing logic
- Network state detection
- Retry logic with various failure scenarios
- Operation grouping and processing

### Integration Tests
- Full sync flow from local operation to remote sync
- Offline/online transitions
- Large batch processing
- Partial batch failures

### Load Testing
- High-frequency operation queuing
- Large batch sizes (100+ operations)
- Multiple concurrent users
- Network condition simulation

### User Experience Testing
- Perceived performance improvements
- Battery usage comparison
- Offline functionality validation
- Sync status clarity

## Performance Benefits

### Expected Improvements
- **90% reduction** in network requests for bulk operations
- **60% improvement** in battery life during heavy usage
- **75% faster** verse addition for multiple verses
- **50% reduction** in API rate limit risk
- **Near-instant** user feedback (unchanged local-first approach)

### Monitoring Metrics
- Batch success rate (target: >95%)
- Average operations per batch (target: 8-12)
- Sync latency (target: <30s for normal priority)
- Queue size over time (target: <50 operations)
- User-initiated sync frequency (target: <1 per session)

## Security Considerations

### Authentication
- Handle JWT token expiry during batch processing
- Support offline operation queuing without immediate auth
- Validate user context for each operation in batch

### Data Integrity
- Atomic batch processing where possible
- Rollback capability for failed operations
- Audit trail for all batch operations
- Prevent duplicate operations in queue

### Privacy
- No sensitive data logged in batch metadata
- Secure storage of queued operations
- Proper cleanup of completed batches

## Conclusion

This batch sync implementation maintains Verses 2.0's local-first philosophy while dramatically improving sync efficiency. Users continue to experience instant local operations while benefiting from intelligent background syncing that adapts to network conditions and usage patterns.

The architecture supports the app's offline-first approach and provides a foundation for future enhancements like conflict resolution, collaborative features, and advanced sync analytics.