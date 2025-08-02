/**
 * Simple reference normalization for alias matching
 * Much simpler than full parsing - just normalizes common variations
 */

export function normalizeReference(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')                    // Multiple spaces → single space
    .replace(/\s*:\s*/g, ':')                // "jn 1 : 1" → "jn 1:1"
    .replace(/\s*-\s*/g, '-')                // "1 - 5" → "1-5"
    .replace(/\s*,\s*/g, ',')                // "1 , 2" → "1,2"
    .replace(/[.]/g, ':')                    // "jn 1.1" → "jn 1:1"
    .replace(/([a-z])(\d)/g, '$1 $2')        // "jn1:1" → "jn 1:1"
    .replace(/\s+/g, ' ')                    // Clean up extra spaces again
    .trim();
}

/**
 * Common book abbreviations for basic normalization
 * Just handles the most common cases - ESV API handles the rest
 */
const COMMON_ABBREVIATIONS: Record<string, string> = {
  // Just the most common ones that users might type differently
  'jhn': 'john',
  'jn': 'john', 
  'matt': 'matthew',
  'mk': 'mark',
  'lk': 'luke',
  '1cor': '1 corinthians',
  '2cor': '2 corinthians',
  '1thess': '1 thessalonians',
  '2thess': '2 thessalonians',
  '1tim': '1 timothy',
  '2tim': '2 timothy',
  '1pet': '1 peter',
  '2pet': '2 peter',
  'rev': 'revelation'
};

/**
 * Apply common abbreviation normalizations
 */
export function normalizeBookAbbreviations(normalized: string): string {
  // Extract book part (everything before the first number)
  const match = normalized.match(/^([a-z\s]+?)(\s+\d+.*)?$/);
  if (!match) return normalized;
  
  const [, bookPart, rest] = match;
  const trimmedBook = bookPart.trim();
  
  // Check if we have a common abbreviation mapping
  const standardBook = COMMON_ABBREVIATIONS[trimmedBook] || trimmedBook;
  
  return rest ? `${standardBook}${rest}` : standardBook;
}

/**
 * Full normalization pipeline
 */
export function normalizeReferenceForLookup(input: string): string {
  let normalized = normalizeReference(input);
  normalized = normalizeBookAbbreviations(normalized);
  return normalized;
}