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
  syncOnOnline?: boolean;
}

export function useBackgroundSync(options: BackgroundSyncOptions = {}) {
  const { user, loading } = useAuth();
  const lastSyncRef = useRef<string | null>(null);
  const dbReadyRef = useRef<boolean>(false);
  
  const {
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
      console.log('sync starting...');
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
      
      if (totalFailed === 0 && totalSynced === 0) {
        console.log('Background sync completed: no changes to sync');
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

  // Initial sync on app load (only when ready)
  useEffect(() => {
    if (!isReadyToSync) return;

    console.log('App loaded - performing initial sync for user:', user?.id);
    
    // Only sync once on app load
    performSync();
  }, [isReadyToSync]);


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