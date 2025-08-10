/**
 * Batch Verse Parser
 * 
 * Parses complex user input like "John 5:1,5,10; Romans 8:28, InvalidBook 1:1; 1 Peter 2:3"
 * into individual verse card requests for separate ESV API calls.
 * 
 * This prevents the ESV API from silently dropping valid references when invalid ones are present.
 */

import { normalizeReferenceForLookup } from './referenceNormalizer';

export interface VerseCardRequest {
  id: string;
  reference: string; // Optimized reference (e.g., "Ephesians 4:1-3")
  originalReference: string; // Original user input (e.g., "eph 4:1,2,3")
  normalizedReference: string;
  originalNormalizedReference: string; // Normalized original input (e.g., "eph41,2,3")
}

export interface BatchParseResult {
  cards: VerseCardRequest[];
}

/**
 * Basic validation to filter out obviously invalid input
 * Lets ESV API handle real Bible reference validation
 */
function looksLikeVerseReference(text: string): boolean {
  const trimmed = text.trim();
  
  // Must have some content
  if (!trimmed) return false;
  
  // Must contain at least one letter (book names have letters)
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  
  // Basic format check - should not contain obviously invalid characters
  if (/[{}[\]()=+*&^%$#@!]/.test(trimmed)) return false;
  
  // Should be reasonable length (not empty, not crazy long)
  if (trimmed.length > 50) return false;
  
  return true;
}

/**
 * Checks if a part looks like just verse numbers (no book name)
 */
function looksLikeJustVerseNumbers(text: string): boolean {
  const trimmed = text.trim();
  // Just numbers, commas, hyphens, and spaces
  return /^[\d\s,-]+$/.test(trimmed) && /\d/.test(trimmed);
}

/**
 * Converts sequential verse numbers to range format
 * e.g., "1,2,3,4" -> "1-4", "1,2,4,5" -> "1-2,4-5"
 */
function consolidateSequentialVerses(verseNumbers: number[]): string {
  if (verseNumbers.length <= 1) {
    return verseNumbers.join(',');
  }
  
  // Sort numbers
  const sorted = [...verseNumbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      // Continue the sequence
      end = sorted[i];
    } else {
      // End of sequence, add range
      if (start === end) {
        ranges.push(start.toString());
      } else {
        // Use range format for 2 or more consecutive numbers
        ranges.push(`${start}-${end}`);
      }
      start = sorted[i];
      end = sorted[i];
    }
  }
  
  // Add the final range
  if (start === end) {
    ranges.push(start.toString());
  } else {
    // Use range format for 2 or more consecutive numbers
    ranges.push(`${start}-${end}`);
  }
  
  return ranges.join(',');
}

/**
 * Optimizes a reference by consolidating sequential verses
 * e.g., "John 5:1,2,3,4" -> "John 5:1-4"
 */
function optimizeReference(reference: string): string {
  const trimmed = reference.trim();
  
  // Check if this looks like book chapter:verse1,verse2,verse3 format (with optional space)
  const match = trimmed.match(/^(.+?\s*)(\d+):([0-9,\s-]+)$/);
  if (!match) {
    return reference; // Not a standard format, return as-is
  }
  
  const [, bookWithSpace, chapter, versesStr] = match;
  
  // Extract verse numbers from comma-separated list
  const verseNumbers: number[] = [];
  const verseParts = versesStr.split(',').map(s => s.trim());
  
  for (const part of verseParts) {
    if (/^\d+$/.test(part)) {
      verseNumbers.push(parseInt(part));
    } else {
      // Complex format (ranges, etc.) - return as-is
      return reference;
    }
  }
  
  if (verseNumbers.length <= 1) {
    return reference; // Single verse, no optimization needed
  }
  
  // Consolidate sequential verses
  const optimized = consolidateSequentialVerses(verseNumbers);
  
  // Rebuild the reference
  return `${bookWithSpace}${chapter}:${optimized}`;
}

/**
 * Splits comma-separated segments based on basic heuristics
 */
function smartCommaSplit(segment: string): string[] {
  const commaParts = segment.split(',').map(s => s.trim()).filter(s => s.length > 0);
  
  if (commaParts.length <= 1) {
    return commaParts;
  }
  
  const result: string[] = [];
  let currentGroup = [commaParts[0]];
  
  for (let i = 1; i < commaParts.length; i++) {
    const currentPart = commaParts[i];
    
    // If this part looks like it contains a book name (has letters), it's probably a new card
    if (looksLikeVerseReference(currentPart) && /[a-zA-Z]/.test(currentPart) && !/^\s*\d+/.test(currentPart)) {
      // Finish current group
      result.push(currentGroup.join(','));
      currentGroup = [currentPart];
    } else if (looksLikeJustVerseNumbers(currentPart)) {
      // This looks like verse numbers from the same chapter, keep together
      currentGroup.push(currentPart);
    } else {
      // Ambiguous case - assume new card to be safe
      result.push(currentGroup.join(','));
      currentGroup = [currentPart];
    }
  }
  
  // Add the last group
  if (currentGroup.length > 0) {
    result.push(currentGroup.join(','));
  }
  
  return result;
}

/**
 * Generates a unique ID for a verse card request
 */
function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Main parser function
 * Parses user input into individual verse card requests
 */
export function parseBatchVerseInput(input: string): BatchParseResult {
  // Handle empty input
  if (!input || !input.trim()) {
    return { cards: [] };
  }
  
  // Step 1: Split on semicolons (definite card boundaries)
  const semicolonSegments = input
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // Step 2: For each segment, smart split on commas
  const allReferences: string[] = [];
  
  for (const segment of semicolonSegments) {
    const commaSegments = smartCommaSplit(segment);
    allReferences.push(...commaSegments);
  }
  
  // Step 3: Optimize references (consolidate sequential verses) and create verse card requests
  // Flow: User Input → Optimized → Normalized (for clean alias table)
  const cards: VerseCardRequest[] = allReferences.map(reference => {
    const originalRef = reference.trim();
    const optimizedRef = optimizeReference(originalRef);
    const normalizedOptimizedRef = normalizeReferenceForLookup(optimizedRef);
    return {
      id: generateCardId(),
      reference: optimizedRef,
      originalReference: originalRef,
      normalizedReference: normalizedOptimizedRef,
      originalNormalizedReference: normalizeReferenceForLookup(originalRef)
    };
  });
  
  return { cards };
}

/**
 * Simple pre-validation to filter out obviously invalid input
 * Lets ESV API handle all real Bible reference validation
 */
export function isLikelyValidReference(reference: string): boolean {
  return looksLikeVerseReference(reference);
}

/**
 * Pre-validates a batch of references and separates likely valid from invalid
 */
export function preValidateBatch(cards: VerseCardRequest[]): {
  likelyValid: VerseCardRequest[];
  likelyInvalid: VerseCardRequest[];
} {
  const likelyValid: VerseCardRequest[] = [];
  const likelyInvalid: VerseCardRequest[] = [];
  
  for (const card of cards) {
    if (isLikelyValidReference(card.reference)) {
      likelyValid.push(card);
    } else {
      likelyInvalid.push(card);
    }
  }
  
  return { likelyValid, likelyInvalid };
}

