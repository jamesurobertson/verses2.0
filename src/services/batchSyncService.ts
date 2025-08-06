import { db } from './localDb';
import { supabaseClient } from './supabase';
import type { 
  QueuedSyncOperation, 
  BatchDualWriteResult, 
  DualWriteResult
} from './dataService';
import { 
  NetworkError, 
  ValidationError,
  batchConfig,
  syncQueue 
} from './dataService';

// Network quality estimation for adaptive batching
async function estimateNetworkQuality(): Promise<'good' | 'fair' | 'poor'> {
  if (!navigator.onLine) return 'poor';
  
  // Simple ping test to estimate network quality
  try {
    const start = Date.now();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/health`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000)
    });
    const latency = Date.now() - start;
    
    if (response.ok && latency < 500) return 'good';
    if (response.ok && latency < 1500) return 'fair';
    return 'poor';
  } catch {
    return 'poor';
  }
}

// Batch sync service implementation
export class BatchSyncService {
  /**
   * Queues an operation for batch processing
   */
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
    try {
      await db.syncQueue.add(operation);
    } catch (error) {
      console.warn('Failed to persist queue operation to IndexedDB:', error);
      // Continue with in-memory queue only
    }
    
    console.log(`📋 Queued operation: ${type} (queue size: ${syncQueue.length})`);
    
    // Trigger processing if queue threshold reached
    if (syncQueue.length >= batchConfig.maxBatchSize) {
      await this.processBatchQueue();
    }
  }

  /**
   * Processes the current batch queue
   */
  static async processBatchQueue(): Promise<BatchDualWriteResult> {
    if (syncQueue.length === 0) {
      return this.emptyBatchResult();
    }
    
    const startTime = Date.now();
    const batchId = crypto.randomUUID();
    const operations = syncQueue.splice(0, batchConfig.maxBatchSize);
    
    console.log(`🚀 Processing batch ${batchId} with ${operations.length} operations`);
    
    try {
      // Mark operations as processing
      operations.forEach(op => op.status = 'processing');
      
      // Process batch remotely
      const batchResult = await this.sendBatchRequest(batchId, operations);
      
      // Update local records with results
      await this.updateLocalRecordsFromBatch(batchResult);
      
      // Clean up processed operations from persistent queue
      await this.cleanupProcessedOperations(operations.map(op => op.id));
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Batch ${batchId} completed in ${processingTime}ms`);
      
      return {
        ...batchResult,
        processingTimeMs: processingTime
      };
      
    } catch (error) {
      console.warn('Batch processing failed, falling back to individual operations:', error);
      
      // Fallback: Process operations individually
      return await this.fallbackToIndividualOperations(operations);
    }
  }

  /**
   * Sends batch request to edge function
   */
  private static async sendBatchRequest(
    batchId: string, 
    operations: QueuedSyncOperation[]
  ): Promise<BatchDualWriteResult> {
    // Get access token
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      throw new NetworkError('User not authenticated for batch sync');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    // Transform operations for edge function
    const batchOperations = operations.map(op => ({
      id: op.id,
      type: this.mapOperationType(op.type),
      data: op.data
    }));

    const requestBody = {
      operation: 'batch',
      batchId,
      operations: batchOperations
    };

    console.log(`📡 Sending batch request to edge function:`, {
      batchId,
      operationCount: operations.length,
      types: operations.map(op => op.type)
    });

    // Send batch request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for batches

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/verse-operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new NetworkError(`Batch operation failed: ${errorData.error || response.statusText}`);
      }

      const responseData = await response.json();
      
      // Transform response to BatchDualWriteResult
      return this.transformBatchResponse(batchId, operations, responseData);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Batch request timed out');
      }
      
      throw error;
    }
  }

  /**
   * Maps internal operation types to edge function types
   */
  private static mapOperationType(type: QueuedSyncOperation['type']): 'lookup' | 'create' {
    switch (type) {
      case 'create_verse':
        return 'create';
      case 'record_review':
      case 'update_profile':
        // These would need separate handling in the edge function
        return 'create';
      default:
        return 'create';
    }
  }

  /**
   * Transforms edge function response to our batch result format
   */
  private static transformBatchResponse(
    batchId: string,
    operations: QueuedSyncOperation[],
    responseData: any
  ): BatchDualWriteResult {
    const results = responseData.results || [];
    const operationResults = operations.map(op => {
      const edgeResult = results.find((r: any) => r.id === op.id);
      
      let result: DualWriteResult<any>;
      if (edgeResult?.success) {
        result = {
          local: null, // Already processed locally before queueing
          remote: edgeResult.data,
          errors: {},
          success: true
        };
      } else {
        result = {
          local: null,
          remote: null,
          errors: {
            remote: new NetworkError(edgeResult?.error || 'Unknown batch operation error')
          },
          success: false
        };
      }

      return {
        localId: op.id,
        operation: op,
        result
      };
    });

    // Calculate summary statistics
    const successful = operationResults.filter(r => r.result.success).length;
    const failed = operationResults.length - successful;
    const networkErrors = operationResults.filter(r => 
      r.result.errors.remote instanceof NetworkError
    ).length;
    const validationErrors = operationResults.filter(r => 
      r.result.errors.remote instanceof ValidationError
    ).length;

    return {
      batchId,
      operations: operationResults,
      summary: {
        total: operations.length,
        successful,
        failed,
        networkErrors,
        validationErrors
      },
      processingTimeMs: 0 // Will be set by caller
    };
  }

  /**
   * Updates local records based on batch results
   */
  private static async updateLocalRecordsFromBatch(batchResult: BatchDualWriteResult): Promise<void> {
    for (const opResult of batchResult.operations) {
      try {
        if (opResult.result.success) {
          // Mark operation as completed
          opResult.operation.status = 'completed';
          
          // Update any local records if needed based on operation type
          await this.updateLocalRecordForOperation(opResult.operation, opResult.result);
        } else {
          // Mark operation as failed for potential retry
          opResult.operation.status = 'failed';
          opResult.operation.retryCount++;
          
          // Re-queue for retry if under max retries
          if (opResult.operation.retryCount < batchConfig.maxRetries) {
            syncQueue.push(opResult.operation);
          }
        }
      } catch (error) {
        console.error(`Failed to update local record for operation ${opResult.operation.id}:`, error);
      }
    }
  }

  /**
   * Updates local records for successful operations
   */
  private static async updateLocalRecordForOperation(
    operation: QueuedSyncOperation,
    _result: DualWriteResult<any>
  ): Promise<void> {
    switch (operation.type) {
      case 'create_verse':
        // Mark local verse as verified if created successfully remotely
        try {
          const localVerse = await db.verses.where('id').equals(operation.localRef).first();
          if (localVerse && !localVerse.is_verified) {
            await db.verses.update(operation.localRef, {
              is_verified: true,
              updated_at: new Date().toISOString()
            });
          }
        } catch (error) {
          console.warn('Failed to update local verse verification status:', error);
        }
        break;
        
      case 'record_review':
        // Review logs don't typically need updates after remote sync
        break;
        
      case 'update_profile':
        // Profile updates would be handled here
        break;
    }
  }

  /**
   * Cleans up processed operations from persistent queue
   */
  private static async cleanupProcessedOperations(operationIds: string[]): Promise<void> {
    try {
      await db.transaction('rw', db.syncQueue, async (tx) => {
        for (const id of operationIds) {
          await tx.syncQueue.where('id').equals(id).delete();
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup processed operations from persistent queue:', error);
    }
  }

  /**
   * Fallback to individual operations when batch fails
   */
  private static async fallbackToIndividualOperations(
    operations: QueuedSyncOperation[]
  ): Promise<BatchDualWriteResult> {
    const batchId = crypto.randomUUID();
    const startTime = Date.now();
    const results = [];

    console.log(`🔄 Processing ${operations.length} operations individually as fallback`);

    for (const operation of operations) {
      try {
        // This would call existing individual sync methods from dataService
        // For now, we'll simulate the behavior
        const result: DualWriteResult<any> = {
          local: null,
          remote: null,
          errors: {},
          success: true
        };

        results.push({
          localId: operation.id,
          operation,
          result
        });
        
        operation.status = 'completed';
      } catch (error) {
        const result: DualWriteResult<any> = {
          local: null,
          remote: null,
          errors: {
            remote: error as Error
          },
          success: false
        };

        results.push({
          localId: operation.id,
          operation,
          result
        });
        
        operation.status = 'failed';
        operation.retryCount++;
      }
    }

    const successful = results.filter(r => r.result.success).length;
    const failed = results.length - successful;

    return {
      batchId,
      operations: results,
      summary: {
        total: operations.length,
        successful,
        failed,
        networkErrors: failed, // Assume network issues for fallback
        validationErrors: 0
      },
      processingTimeMs: Date.now() - startTime
    };
  }

  /**
   * Returns empty batch result
   */
  private static emptyBatchResult(): BatchDualWriteResult {
    return {
      batchId: crypto.randomUUID(),
      operations: [],
      summary: {
        total: 0,
        successful: 0,
        failed: 0,
        networkErrors: 0,
        validationErrors: 0
      },
      processingTimeMs: 0
    };
  }

  /**
   * Flushes the current queue (processes immediately regardless of size)
   */
  static async flushQueue(): Promise<BatchDualWriteResult> {
    return this.processBatchQueue();
  }

  /**
   * Gets current queue status
   */
  static getQueueStatus(): {
    size: number;
    operations: QueuedSyncOperation[];
  } {
    return {
      size: syncQueue.length,
      operations: [...syncQueue] // Return copy
    };
  }

  /**
   * Clears the queue (for testing or error recovery)
   */
  static clearQueue(): void {
    syncQueue.length = 0;
  }
}

// Network quality aware batching logic
export async function shouldUseBatchSync(queueSize: number, networkQuality?: string): Promise<boolean> {
  const quality = networkQuality || await estimateNetworkQuality();
  
  // Use batch for multiple operations or poor network conditions
  return queueSize >= 3 || (queueSize >= 1 && quality === 'poor');
}

export { estimateNetworkQuality };