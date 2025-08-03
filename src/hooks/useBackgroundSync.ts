/**
 * Background Sync Hook
 * 
 * Simple, functional background sync for catching missed real-time syncs
 * and pulling changes from other devices.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { db } from '../services/localDb';

interface BackgroundSyncOptions {
  intervalMinutes?: number;
  syncOnFocus?: boolean;
  syncOnOnline?: boolean;
}

export function useBackgroundSync(options: BackgroundSyncOptions = {}) {
  const { user, loading } = useAuth();
  const lastSyncRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const dbReadyRef = useRef<boolean>(false);
  
  const {
    intervalMinutes = 5, // Default 5 minutes
    syncOnFocus = true,
    syncOnOnline = true
  } = options;

  // Check if we're ready to sync (auth complete + DB ready)
  const isReadyToSync = user && !loading && dbReadyRef.current;

  // Perform sync operation
  const performSync = async () => {
    if (!isReadyToSync) {
      console.log('Background sync skipped - not ready', { 
        hasUser: !!user, 
        authLoading: loading, 
        dbReady: dbReadyRef.current 
      });
      return;
    }

    try {
      console.log('Background sync starting...');
      const result = await dataService.sync(user.id, lastSyncRef.current || undefined);
      
      // Update last sync timestamp for next incremental sync
      lastSyncRef.current = result.lastSyncTimestamp;
      
      // Log results
      const totalSynced = result.toRemote.synced + result.fromRemote.synced;
      const totalFailed = result.toRemote.failed + result.fromRemote.failed;
      
      if (totalSynced > 0) {
        console.log(`Background sync completed: ${totalSynced} items synced`);
      }
      
      if (totalFailed > 0) {
        console.warn(`Background sync issues: ${totalFailed} items failed`);
      }
      
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  };

  // Initialize IndexedDB connection
  useEffect(() => {
    const initDB = async () => {
      try {
        await db.open();
        dbReadyRef.current = true;
        console.log('IndexedDB ready for background sync');
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        dbReadyRef.current = false;
      }
    };

    initDB();
  }, []);

  // Set up periodic sync (only when ready)
  useEffect(() => {
    if (!isReadyToSync) return;

    console.log('Starting background sync for user:', user?.id);

    // Start periodic sync
    intervalRef.current = setInterval(performSync, intervalMinutes * 60 * 1000);

    // Initial sync when ready
    performSync();

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('Background sync stopped');
      }
    };
  }, [isReadyToSync, intervalMinutes]);

  // Sync on window focus (user returns to app)
  useEffect(() => {
    if (!syncOnFocus) return;

    const handleFocus = () => {
      if (isReadyToSync) {
        console.log('App focused - triggering sync');
        performSync();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [syncOnFocus, isReadyToSync]);

  // Sync when network comes back online
  useEffect(() => {
    if (!syncOnOnline) return;

    const handleOnline = () => {
      if (isReadyToSync) {
        console.log('Network online - triggering sync');
        performSync();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncOnOnline, isReadyToSync]);

  return {
    performSync, // Allow manual sync trigger
    lastSync: lastSyncRef.current,
    isReady: isReadyToSync // Expose ready state for debugging
  };
}