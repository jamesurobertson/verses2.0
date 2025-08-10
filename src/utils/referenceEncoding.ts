/**
 * Reference URL Encoding/Decoding Utilities
 * 
 * Uses URL-safe format: spaces become +, colons become v, preserves hyphens
 * Examples:
 * - "John 3:16" → "John+3v16"
 * - "1 Corinthians 13:4-8" → "1+Corinthians+13v4-8"
 * - "Genesis 1:1-2:3" → "Genesis+1v1-2v3"
 */

/**
 * Encode a Bible reference for use in URLs
 * Uses URL-safe format with + for spaces and v for verse separator
 */
export function encodeReference(reference: string): string {
  if (!reference || typeof reference !== 'string') {
    return '';
  }

  // Handle semicolon-separated groups
  if (reference.includes(';')) {
    return reference
      .split(';')
      .map(part => encodeSingleReference(part.trim()))
      .join('_');
  }
  
  return encodeSingleReference(reference);
}

/**
 * Encode a single reference (no semicolons)
 */
function encodeSingleReference(reference: string): string {
  if (!reference) return '';
  
  return reference
    .trim()
    .replace(/\s+/g, '+')      // Spaces to plus signs
    .replace(/:/g, 'v')        // Colons to 'v' (verse indicator)
    .replace(/[^\w+v,_\-–]/g, '') // Keep only word chars, +, v, commas, underscores, hyphens, en dashes
    .replace(/\+{2,}/g, '+')   // Collapse multiple plus signs
    .replace(/^\+|\+$/g, '');  // Remove leading/trailing plus signs
}

/**
 * Decode a URL-encoded reference back to a searchable format
 * Handles complex formats including:
 * - Single verses: "John+3v16" → "John 3:16"
 * - Numbered books: "1+John+3v16" → "1 John 3:16"
 * - Verse ranges: "Psalm+23v1-6" → "Psalm 23:1-6"
 * - Multiple groups: "John+3v16_Romans+8v28" → "John 3:16; Romans 8:28"
 */
export function decodeReference(encoded: string): string {
  if (!encoded || typeof encoded !== 'string') {
    return '';
  }
  
  // Handle multiple reference groups
  if (encoded.includes('_')) {
    return encoded
      .split('_')
      .map(part => decodeSingleReference(part))
      .join('; ');
  }
  
  return decodeSingleReference(encoded);
}

/**
 * Decode a single reference (no semicolons)
 */
function decodeSingleReference(encoded: string): string {
  if (!encoded) return '';
  
  return encoded
    .replace(/\+/g, ' ')       // Plus signs back to spaces
    .replace(/v/g, ':')        // 'v' back to colons
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize first letter of each word
}

/**
 * Get the canonical reference format for database lookup
 * This handles common variations and normalizes to ESV format
 */
export function normalizeReference(reference: string): string {
  if (!reference) return '';
  
  return reference
    .trim()
    .replace(/\b1st\b/gi, '1')
    .replace(/\b2nd\b/gi, '2')
    .replace(/\b3rd\b/gi, '3')
    .replace(/\bfirst\b/gi, '1')
    .replace(/\bsecond\b/gi, '2')
    .replace(/\bthird\b/gi, '3')
    .replace(/\s+/g, ' ')
    .trim();
}