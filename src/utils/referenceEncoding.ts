/**
 * Reference URL Encoding/Decoding Utilities
 * 
 * Handles safe encoding of Bible references for use in URLs
 * and decoding them back to canonical format.
 */

/**
 * Encode a Bible reference for use in URLs
 * Examples:
 * "John 3:16" → "john-3-16"
 * "1 John 3:16" → "1-john-3-16"  
 * "Psalm 23:1-6" → "psalm-23-1-6"
 */
export function encodeReference(reference: string): string {
  return reference
    .toLowerCase()
    .replace(/\s+/g, '-')      // Spaces to hyphens
    .replace(/:/g, '-')        // Colons to hyphens
    .replace(/[^\w-]/g, '')    // Remove non-word chars except hyphens
    .replace(/-+/g, '-')       // Collapse multiple hyphens
    .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
}

/**
 * Decode a URL-encoded reference back to a searchable format
 * This doesn't restore exact capitalization, but creates a format
 * that can be used for database lookups
 * 
 * Examples:
 * "john-3-16" → "john 3:16"
 * "1-john-3-16" → "1 john 3:16"
 * "psalm-23-1-6" → "psalm 23:1-6"
 */
export function decodeReference(encoded: string): string {
  if (!encoded) return '';
  
  // Split by hyphens
  const parts = encoded.split('-').filter(part => part.length > 0);
  
  if (parts.length < 2) return encoded;
  
  // Reconstruct: book name(s) + chapter + optional verse/range
  const result = [];
  let i = 0;
  
  // Handle book name (could be multiple words like "1 john")
  while (i < parts.length && !isNumeric(parts[i])) {
    result.push(parts[i]);
    i++;
  }
  
  // If we haven't found any numbers yet, take at least one part as book name
  if (result.length === 0 && i < parts.length) {
    result.push(parts[i]);
    i++;
  }
  
  // Add chapter number
  if (i < parts.length) {
    result.push(parts[i]);
    i++;
    
    // Add verse/range (everything after chapter with colons and hyphens)
    if (i < parts.length) {
      const versesPart = parts.slice(i).join('-');
      // Convert first hyphen to colon (chapter:verse separator)
      const versesWithColon = versesPart.replace('-', ':');
      result.push(versesWithColon);
    }
  }
  
  return result.join(' ');
}

/**
 * Check if a string represents a number
 */
function isNumeric(str: string): boolean {
  return /^\d+$/.test(str);
}

/**
 * Get the canonical reference format for database lookup
 * This handles common variations and normalizes to ESV format
 */
export function normalizeReference(reference: string): string {
  // This would use the existing normalizeReferenceForLookup function
  // Import it when we implement this
  return reference.trim();
}