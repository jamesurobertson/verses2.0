import { config } from '../utils/env';
import { sanitizeBibleReference } from '../utils/sanitization';

// ESV API Response Types
export interface ESVPassageResponse {
  query: string;
  canonical: string;
  parsed: string[][];
  passage_meta: Array<{
    canonical: string;
    chapter_start: number[];
    chapter_end: number[];
    prev_verse: number;
    next_verse: number;
    prev_chapter: number[];
    next_chapter: number[];
  }>;
  passages: string[];
}

export interface ESVErrorResponse {
  detail: string;
}

// Type guard for ESV error responses
export function isESVError(response: any): response is ESVErrorResponse {
  return response !== null && response !== undefined && typeof response === 'object' && 'detail' in response && typeof response.detail === 'string';
}

// Cache interface
interface CacheEntry {
  data: ESVPassageResponse;
  timestamp: number;
}

// ESV API Client Class
class ESVApiClient {
  private cache = new Map<string, CacheEntry>();
  private readonly baseUrl = config.esv.baseUrl;
  private readonly apiKey = config.esv.apiKey;
  private readonly cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxCacheSize = 1000;

  /**
   * Fetches a Bible passage from the ESV API with caching.
   */
  async getPassage(reference: string): Promise<ESVPassageResponse> {
    // Validate and sanitize input
    if (!reference || reference.trim() === '') {
      throw new Error('Please enter a valid Bible reference (e.g., "John 3:16")');
    }

    if (reference.length > 200) {
      throw new Error('Bible reference is too long');
    }

    const sanitizedReference = sanitizeBibleReference(reference);

    // Check cache first
    const cacheKey = this.normalizeCacheKey(sanitizedReference);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Make API request
    const result = await this.fetchPassage(sanitizedReference);
    
    // Validate response
    if (!result.passages || result.passages.length === 0) {
      throw new Error('No verse found for this reference. Please check the spelling and try again.');
    }

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Makes the actual API request.
   */
  private async fetchPassage(reference: string): Promise<ESVPassageResponse> {
    try {
      const url = this.buildApiUrl(reference);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error('Invalid Bible reference. Please check the spelling and try again.');
        }
        
        if (response.status === 401) {
          throw new Error('Unable to connect to Bible service. Please try again later.');
        }

        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }

        throw new Error('Unable to fetch verse. Please check your internet connection and try again.');
      }

      // Parse successful response
      const data = await response.json();
      
      if (!this.isValidESVResponse(data)) {
        throw new Error('Received invalid response from Bible service. Please try again.');
      }

      return data as ESVPassageResponse;

    } catch (error) {
      if (error instanceof Error) {
        // Re-throw user-friendly errors
        throw error;
      }
      throw new Error('Unable to fetch verse. Please check your internet connection and try again.');
    }
  }

  /**
   * Builds the ESV API URL with proper parameters.
   */
  private buildApiUrl(reference: string): string {
    const params = new URLSearchParams({
      q: reference,
      'include-headings': 'false',
      'include-footnotes': 'false',
      'include-verse-numbers': 'false',
      'include-short-copyright': 'false',
      'include-passage-references': 'false'
    });

    return `${this.baseUrl}/passage/text/?${params.toString()}`;
  }

  /**
   * Validates that the response has the expected ESV API structure.
   */
  private isValidESVResponse(data: any): data is ESVPassageResponse {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.query === 'string' &&
      typeof data.canonical === 'string' &&
      Array.isArray(data.parsed) &&
      Array.isArray(data.passage_meta) &&
      Array.isArray(data.passages)
    );
  }

  /**
   * Normalizes cache keys to handle different reference formats.
   */
  private normalizeCacheKey(reference: string): string {
    return reference.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Gets data from cache if valid and not expired.
   */
  private getFromCache(key: string): ESVPassageResponse | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheExpiryMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Sets data in cache with size limits.
   */
  private setCache(key: string, data: ESVPassageResponse): void {
    // Implement LRU cache behavior by removing oldest entries
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clears the cache (useful for testing or memory management).
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const esvApi = new ESVApiClient();