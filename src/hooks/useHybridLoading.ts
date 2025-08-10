import { useState, useEffect, useRef, useCallback } from 'react';

const SKELETON_DELAY = 10; // ms delay before showing skeleton (debugging)
const MIN_SKELETON_DURATION = 300; // ms minimum time to show skeleton

interface UseHybridLoadingOptions {
  skeletonDelay?: number;
  minSkeletonDuration?: number;
}

export function useHybridLoading(
  isActuallyLoading: boolean,
  options: UseHybridLoadingOptions = {}
) {
  const {
    skeletonDelay = SKELETON_DELAY,
    minSkeletonDuration = MIN_SKELETON_DURATION
  } = options;

  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const minDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const skeletonShownAtRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (minDurationTimerRef.current) {
      clearTimeout(minDurationTimerRef.current);
      minDurationTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isActuallyLoading) {
      console.log('🔄 Hybrid Loading: Starting loading, isActuallyLoading =', isActuallyLoading);
      // Reset state for new loading
      setIsComplete(false);
      
      // Start delay timer to show skeleton
      delayTimerRef.current = setTimeout(() => {
        console.log('🔄 Hybrid Loading: Delay timer fired, isActuallyLoading =', isActuallyLoading);
        if (isActuallyLoading) { // Double-check still loading
          console.log('✅ Hybrid Loading: Showing skeleton');
          setShowSkeleton(true);
          skeletonShownAtRef.current = Date.now();
        } else {
          console.log('❌ Hybrid Loading: Not showing skeleton - loading finished');
        }
      }, skeletonDelay);

    } else {
      // Loading finished
      cleanup();
      
      if (showSkeleton && skeletonShownAtRef.current) {
        // Calculate how long skeleton has been shown
        const skeletonDuration = Date.now() - skeletonShownAtRef.current;
        
        if (skeletonDuration < minSkeletonDuration) {
          // Show skeleton for remaining minimum duration
          const remainingTime = minSkeletonDuration - skeletonDuration;
          
          minDurationTimerRef.current = setTimeout(() => {
            setShowSkeleton(false);
            setIsComplete(true);
            skeletonShownAtRef.current = null;
          }, remainingTime);
        } else {
          // Minimum duration already met
          setShowSkeleton(false);
          setIsComplete(true);
          skeletonShownAtRef.current = null;
        }
      } else {
        // Skeleton was never shown (loading was very fast)
        setIsComplete(true);
      }
    }

    return cleanup;
  }, [isActuallyLoading, showSkeleton, skeletonDelay, minSkeletonDuration, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    showSkeleton,
    isComplete: isComplete && !isActuallyLoading
  };
}