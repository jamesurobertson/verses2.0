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
    .replace(/\s*[-–]\s*/g, '-')             // "1 - 5" or "1 – 5" → "1-5" (handles both hyphens and en dashes)
    .replace(/\s*[,;]\s*/g, ',')             // "1 , 2" or "1 ; 2" → "1,2" (normalize both commas and semicolons)
    .replace(/[.]/g, ':')                    // "jn 1.1" → "jn 1:1"
    .replace(/([a-z])(\d)/g, '$1 $2')        // "jn1:1" → "jn 1:1"
    .replace(/\s+/g, ' ')                    // Clean up extra spaces again
    .trim();
}

/**
 * Normalize complex verse references with repeated book names
 * ESV API expands "Luke 2:1-4, 6" to "Luke 2:1-4; Luke 2:6; Luke 2:9"
 * This function collapses repeated book references back to compact form
 */
export function normalizeComplexReference(input: string): string {
  let normalized = normalizeReference(input);

  // Handle repeated book names in semicolon-separated references
  // "luke 2:1-4; luke 2:6; luke 2:9" → "luke 2:1-4,6,9"
  if (normalized.includes(',')) {
    // Split by commas and extract unique book+chapter patterns
    const parts = normalized.split(',');
    const firstPart = parts[0].trim();
    const bookChapter = firstPart.match(/^([a-z0-9\s]+\s\d+):/);

    if (bookChapter) {
      const bookChapterPrefix = bookChapter[1];
      const collapsedParts = parts.map(part => {
        const trimmed = part.trim();
        // If this part starts with the same book+chapter, remove the prefix
        if (trimmed.startsWith(bookChapterPrefix + ':')) {
          return trimmed.substring(bookChapterPrefix.length + 1);
        }
        return trimmed;
      });

      normalized = firstPart + ',' + collapsedParts.slice(1).join(',');
    }
  }

  return normalized;
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
  '1 cor': '1 corinthians',
  '2cor': '2 corinthians',
  '2 cor': '2 corinthians',
  '1thess': '1 thessalonians',
  '1 thess': '1 thessalonians',
  '2thess': '2 thessalonians',
  '2 thess': '2 thessalonians',
  '1tim': '1 timothy',
  '1 tim': '1 timothy',
  '2tim': '2 timothy',
  '2 tim': '2 timothy',
  '1pet': '1 peter',
  '1 pet': '1 peter',
  '2pet': '2 peter',
  '2 pet': '2 peter',
  'rev': 'revelation'
};

/**
 * Apply common abbreviation normalizations
 */
export function normalizeBookAbbreviations(normalized: string): string {
  // Extract book part (everything before chapter:verse pattern)
  // Match patterns like "1 cor 13:4-8" where book is "1 cor" and rest is " 13:4-8"
  const match = normalized.match(/^([0-9]*\s*[a-z]+(?:\s+[a-z]+)*)\s+(\d+.*)$/);
  if (!match) return normalized;

  const [, bookPart, rest] = match;
  const trimmedBook = bookPart.trim();

  // Check if we have a common abbreviation mapping
  const standardBook = COMMON_ABBREVIATIONS[trimmedBook] || trimmedBook;

  return `${standardBook} ${rest}`;
}

/**
 * Full normalization pipeline
 */
export function normalizeReferenceForLookup(input: string): string {
  return normalizeComplexReference(normalizeBookAbbreviations(normalizeReference(input))
  );
}
