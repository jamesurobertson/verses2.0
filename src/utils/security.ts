/**
 * Content Security Policy configuration for the Bible Memory App.
 * Implements essential security measures to prevent XSS and other attacks.
 */

export const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Vite dev mode
    "'unsafe-eval'", // Required for Vite dev mode
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for inline styles and CSS-in-JS
    'https://fonts.googleapis.com',
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
  ],
  'connect-src': [
    "'self'",
    'https://api.esv.org', // ESV API
    'https://*.supabase.co', // Supabase
    'https://*.supabase.io', // Supabase (alternative domain)
  ],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
};

/**
 * Generates CSP header value from directives.
 */
export function generateCSPHeader(): string {
  return Object.entries(cspDirectives)
    .map(([directive, values]) => {
      const valueString = values.length > 0 ? ` ${values.join(' ')}` : '';
      return `${directive}${valueString}`;
    })
    .join('; ');
}

/**
 * Rate limiting configuration for API calls.
 */
export const rateLimits = {
  esv: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 5000,
  },
  general: {
    requestsPerMinute: 100,
    requestsPerHour: 2000,
  },
} as const;

/**
 * Simple rate limiter implementation for client-side rate limiting.
 */
class RateLimiter {
  private requests: number[] = [];

  constructor(private maxRequests: number, private windowMs: number) {}

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }

  getNextAllowedTime(): number {
    if (this.requests.length === 0) return 0;
    return this.requests[0] + this.windowMs;
  }
}

// Export rate limiter instances
export const esvApiRateLimiter = new RateLimiter(60, 60 * 1000); // 60 requests per minute
export const generalRateLimiter = new RateLimiter(100, 60 * 1000); // 100 requests per minute