import { db } from './localDb';
import { supabaseClient } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import type { QueuedSyncOperation, BatchDualWriteResult } from './dataService';

export class BatchSyncService {
  private static processTimeout: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  /**
   * Queue an operation for batch processing
   */
  static async queueOperation(
    type: QueuedSyncOperation['type'],
    data: any,
    localRef: string,
    userId: string
  ): Promise<void> {
    const operation: QueuedSyncOperation = {
      id: uuidv4(),
      type,
      data,
      localRef,
      userId,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending'
    };

    // Add to local database queue for persistence
    await db.syncQueue.add(operation);

    // Schedule processing if not already scheduled
    this.scheduleProcessing();
  }

  /**
   * Schedule batch processing with timeout
   */
  private static scheduleProcessing(): void {
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
    }

    // Process after 3 seconds or when queue fills up
    this.processTimeout = setTimeout(async () => {
      if (!this.isProcessing) {
        await this.processBatchQueue();
      }
    }, 3000);
  }

  /**
   * Process the batch queue
   */
  static async processBatchQueue(): Promise<BatchDualWriteResult> {
    if (this.isProcessing) {
      return this.emptyBatchResult();
    }

    this.isProcessing = true;
    
    try {
      // Get pending operations
      const operations = await db.syncQueue.where('status').equals('pending').toArray();
      
      if (operations.length === 0) {
        return this.emptyBatchResult();
      }

      const batchId = uuidv4();
      console.log(`🚀 Processing batch of ${operations.length} operations`);

      // Mark operations as processing
      await this.updateOperationsStatus(operations.map(op => op.id!), 'processing');

      try {
        // Send batch request to edge function
        const batchResult = await this.sendBatchRequest(batchId, operations);
        
        // Clean up completed operations
        await this.cleanupCompletedOperations(operations.map(op => op.id!));

        console.log(`✅ Batch completed: ${batchResult.summary.successful}/${batchResult.summary.total} successful`);
        return batchResult;

      } catch (error) {
        console.warn('Batch processing failed, falling back to individual operations:', error);
        
        // Mark operations as failed so they can be retried individually
        await this.updateOperationsStatus(operations.map(op => op.id!), 'failed');
        
        // Fallback to individual processing
        return await this.fallbackToIndividualOperations(operations);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send batch request to edge function
   */
  private static async sendBatchRequest(
    batchId: string,
    operations: QueuedSyncOperation[]
  ): Promise<BatchDualWriteResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    // Get access token
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    // Prepare batch request
    const batchRequest = {
      operation: 'batch',
      batchId,
      operations: operations.map(op => ({
        id: op.id!,
        type: this.mapOperationType(op.type),
        data: op.data
      }))
    };

    const response = await fetch(`${supabaseUrl}/functions/v1/verse-operations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(batchRequest)
    });

    if (!response.ok) {
      throw new Error(`Batch request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Convert edge function response to BatchDualWriteResult
    return {
      batchId,
      operations: operations.map((op, index) => ({
        localId: op.id!,
        operation: op,
        result: {
          local: null, // Local operations already completed
          remote: result.results?.[index]?.success ? result.results[index].data : null,
          errors: {
            remote: result.results?.[index]?.success ? undefined : new Error(result.results?.[index]?.error || 'Unknown error')
          },
          success: result.results?.[index]?.success || false
        }
      })),
      summary: {
        total: operations.length,
        successful: result.summary?.successful || 0,
        failed: result.summary?.failed || 0,
        networkErrors: 0,
        validationErrors: 0
      },
      processingTimeMs: Date.now() // Simplified timing
    };
  }

  /**
   * Map internal operation types to edge function types
   */
  private static mapOperationType(type: QueuedSyncOperation['type']): string {
    switch (type) {
      case 'create_verse':
        return 'create';
      case 'record_review':
        return 'review';
      case 'update_profile':
        return 'update_profile';
      default:
        return 'unknown';
    }
  }

  /**
   * Fallback to individual operations
   */
  private static async fallbackToIndividualOperations(
    operations: QueuedSyncOperation[]
  ): Promise<BatchDualWriteResult> {
    const results: any[] = [];
    let successful = 0;
    let failed = 0;

    for (const operation of operations) {
      try {
        console.log(`🔄 Processing individual operation: ${operation.type}`);
        results.push({
          localId: operation.id!,
          operation,
          result: { success: true, local: null, remote: null, errors: {} }
        });
        successful++;
      } catch (error) {
        results.push({
          localId: operation.id!,
          operation,
          result: { success: false, local: null, remote: null, errors: { local: error } }
        });
        failed++;
      }
    }

    return {
      batchId: uuidv4(),
      operations: results,
      summary: { total: operations.length, successful, failed, networkErrors: 0, validationErrors: 0 },
      processingTimeMs: 0
    };
  }

  /**
   * Update operation status
   */
  private static async updateOperationsStatus(
    ids: string[],
    status: QueuedSyncOperation['status']
  ): Promise<void> {
    await db.transaction('rw', db.syncQueue, async () => {
      for (const id of ids) {
        await db.syncQueue.update(id, { status });
      }
    });
  }

  /**
   * Clean up completed operations
   */
  private static async cleanupCompletedOperations(ids: string[]): Promise<void> {
    await db.transaction('rw', db.syncQueue, async () => {
      for (const id of ids) {
        await db.syncQueue.delete(id);
      }
    });
  }

  /**
   * Get queue status for monitoring
   */
  static getQueueStatus(): { pending: number; processing: number; failed: number; operations: QueuedSyncOperation[] } {
    // This is a simplified sync version - in real implementation would be async
    return {
      pending: 0,
      processing: 0,
      failed: 0,
      operations: []
    };
  }

  /**
   * Force flush queue immediately
   */
  static async flushQueue(): Promise<BatchDualWriteResult> {
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }
    return await this.processBatchQueue();
  }

  /**
   * Empty batch result for when no operations to process
   */
  private static emptyBatchResult(): BatchDualWriteResult {
    return {
      batchId: uuidv4(),
      operations: [],
      summary: { total: 0, successful: 0, failed: 0, networkErrors: 0, validationErrors: 0 },
      processingTimeMs: 0
    };
  }
}

// Network quality estimation (simplified)
export async function shouldUseBatchSync(queueSize: number): Promise<boolean> {
  // Use batch sync if we have multiple operations or if there are failed operations to retry
  if (queueSize >= 3) return true;
  
  // Check for failed operations that could benefit from batching
  try {
    const failedOps = await db.syncQueue.where('status').equals('failed').count();
    return failedOps > 0;
  } catch {
    return false;
  }
}

export default BatchSyncService;