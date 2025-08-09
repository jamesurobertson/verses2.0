/**
 * Network Detection Service
 * 
 * Helps distinguish between actual network connectivity issues
 * and external API service outages (like ESV API being down).
 */

export interface NetworkStatus {
  isOnline: boolean;
  hasInternetAccess: boolean;
  canReachSupabase: boolean;
}

/**
 * Test actual network connectivity using multiple methods
 */
export async function detectNetworkStatus(): Promise<NetworkStatus> {
  // Start with browser's basic network detection
  const isOnline = navigator.onLine;
  
  if (!isOnline) {
    return {
      isOnline: false,
      hasInternetAccess: false,
      canReachSupabase: false
    };
  }

  // Test internet connectivity with a reliable service
  let hasInternetAccess = false;
  try {
    // Use multiple endpoints to test internet connectivity
    const connectivityTests = [
      fetch('https://www.google.com/favicon.ico', { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      }),
      fetch('https://httpbin.org/get', { 
        method: 'HEAD',
        cache: 'no-cache', 
        signal: AbortSignal.timeout(5000)
      }),
    ];

    // If any connectivity test succeeds, we have internet
    await Promise.any(connectivityTests);
    hasInternetAccess = true;
  } catch (error) {
    console.log('Internet connectivity test failed:', error);
    hasInternetAccess = false;
  }

  // Test Supabase connectivity specifically
  let canReachSupabase = false;
  if (hasInternetAccess) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const response = await fetch(`${supabaseUrl}/health`, {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
        canReachSupabase = response.ok || response.status < 500; // 4xx is ok, 5xx is not
      }
    } catch (error) {
      console.log('Supabase connectivity test failed:', error);
      canReachSupabase = false;
    }
  }

  return {
    isOnline,
    hasInternetAccess,
    canReachSupabase
  };
}

/**
 * Determine if an error is a true network connectivity issue
 * vs an external service being down
 */
export function isNetworkConnectivityError(error: any, networkStatus?: NetworkStatus): boolean {
  // If we have network status, use it
  if (networkStatus) {
    return !networkStatus.hasInternetAccess;
  }

  // Fallback to error analysis
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorName = error?.name?.toLowerCase() || '';
  
  // These indicate true network connectivity issues
  const networkIndicators = [
    'failed to fetch',
    'network error',
    'no internet',
    'connection refused', 
    'connection reset',
    'connection timeout',
    'dns',
    'enetunreach',
    'enotfound',
    'econnreset',
    'econnrefused',
    'typeerror: fetch', // Often indicates network issues
  ];

  // These indicate the user is online but service might be down
  const serviceIndicators = [
    'internal server error',
    'bad gateway', 
    'service unavailable',
    'gateway timeout',
    'server error',
    '500',
    '502', 
    '503',
    '504'
  ];

  // Check for clear network indicators first
  const hasNetworkIndicator = networkIndicators.some(indicator => 
    errorMessage.includes(indicator) || errorName.includes(indicator)
  );

  if (hasNetworkIndicator) return true;

  // If it's a service error, it's NOT a network connectivity issue
  const hasServiceIndicator = serviceIndicators.some(indicator =>
    errorMessage.includes(indicator)
  );

  if (hasServiceIndicator) return false;

  // For ambiguous cases, default to NOT a network issue
  // (better to avoid false positives that confuse users)
  return false;
}

/**
 * Get appropriate error message based on error type
 */
export function getErrorMessage(error: any, networkStatus?: NetworkStatus): string {
  if (isNetworkConnectivityError(error, networkStatus)) {
    return 'Connection issue detected. Please check your internet connection and try again.';
  }
  
  // Check for specific API errors
  const errorMessage = error?.message || '';
  
  if (errorMessage.includes('500') || errorMessage.includes('502') || 
      errorMessage.includes('503') || errorMessage.includes('504')) {
    return 'The ESV Bible service is temporarily unavailable. Please try again in a moment.';
  }
  
  if (errorMessage.includes('ESV') || errorMessage.includes('api')) {
    return 'Unable to retrieve verse from ESV Bible service. Please try again.';
  }
  
  // Default fallback
  return 'Unable to add verse right now. Please try again.';
}