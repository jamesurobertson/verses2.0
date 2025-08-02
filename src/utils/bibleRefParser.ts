import { sanitizeBibleReference } from './sanitization';

// Types for parsed Bible references
export interface ParsedReference {
  book: string;
  chapter?: number;
  startVerse?: number | null;
  endVerse?: number | null;
  originalText: string;
  // For complex ranges
  verses?: Array<{ start: number; end: number }>;
  // For cross-chapter ranges
  startChapter?: number;
  endChapter?: number;
}

// Bible book mappings and metadata
const BOOK_ABBREVIATIONS: Record<string, string> = {
  // Old Testament
  'gen': 'Genesis', 'genesis': 'Genesis',
  'ex': 'Exodus', 'exod': 'Exodus', 'exodus': 'Exodus',
  'lev': 'Leviticus', 'leviticus': 'Leviticus',
  'num': 'Numbers', 'numbers': 'Numbers',
  'deut': 'Deuteronomy', 'dt': 'Deuteronomy', 'deuteronomy': 'Deuteronomy',
  'josh': 'Joshua', 'joshua': 'Joshua',
  'judg': 'Judges', 'jdg': 'Judges', 'judges': 'Judges',
  'ruth': 'Ruth',
  '1 sam': '1 Samuel', '1sam': '1 Samuel', '1 samuel': '1 Samuel',
  '2 sam': '2 Samuel', '2sam': '2 Samuel', '2 samuel': '2 Samuel',
  '1 kings': '1 Kings', '1kgs': '1 Kings', '1 kg': '1 Kings',
  '2 kings': '2 Kings', '2kgs': '2 Kings', '2 kg': '2 Kings',
  '1 chr': '1 Chronicles', '1chr': '1 Chronicles', '1 chronicles': '1 Chronicles',
  '2 chr': '2 Chronicles', '2chr': '2 Chronicles', '2 chronicles': '2 Chronicles',
  'ezra': 'Ezra',
  'neh': 'Nehemiah', 'nehemiah': 'Nehemiah',
  'esth': 'Esther', 'esther': 'Esther',
  'job': 'Job',
  'ps': 'Psalms', 'psa': 'Psalms', 'psalm': 'Psalm', 'psalms': 'Psalms',
  'prov': 'Proverbs', 'proverbs': 'Proverbs',
  'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'ecclesiastes': 'Ecclesiastes',
  'song': 'Song of Solomon', 'sos': 'Song of Solomon', 'song of solomon': 'Song of Solomon',
  'isa': 'Isaiah', 'is': 'Isaiah', 'isaiah': 'Isaiah',
  'jer': 'Jeremiah', 'jeremiah': 'Jeremiah',
  'lam': 'Lamentations', 'lamentations': 'Lamentations',
  'ezek': 'Ezekiel', 'eze': 'Ezekiel', 'ezekiel': 'Ezekiel',
  'dan': 'Daniel', 'daniel': 'Daniel',
  'hos': 'Hosea', 'hosea': 'Hosea',
  'joel': 'Joel',
  'amos': 'Amos',
  'obad': 'Obadiah', 'obadiah': 'Obadiah',
  'jonah': 'Jonah',
  'mic': 'Micah', 'micah': 'Micah',
  'nah': 'Nahum', 'nahum': 'Nahum',
  'hab': 'Habakkuk', 'habakkuk': 'Habakkuk',
  'zeph': 'Zephaniah', 'zep': 'Zephaniah', 'zephaniah': 'Zephaniah',
  'hag': 'Haggai', 'haggai': 'Haggai',
  'zech': 'Zechariah', 'zec': 'Zechariah', 'zechariah': 'Zechariah',
  'mal': 'Malachi', 'malachi': 'Malachi',
  
  // New Testament
  'mt': 'Matthew', 'matt': 'Matthew', 'matthew': 'Matthew',
  'mk': 'Mark', 'mark': 'Mark',
  'lk': 'Luke', 'luke': 'Luke',
  'jn': 'John', 'john': 'John',
  'acts': 'Acts',
  'rom': 'Romans', 'romans': 'Romans',
  '1 cor': '1 Corinthians', '1cor': '1 Corinthians', '1 corinthians': '1 Corinthians',
  '2 cor': '2 Corinthians', '2cor': '2 Corinthians', '2 corinthians': '2 Corinthians',
  'gal': 'Galatians', 'galatians': 'Galatians',
  'eph': 'Ephesians', 'ephesians': 'Ephesians',
  'phil': 'Philippians', 'php': 'Philippians', 'philippians': 'Philippians',
  'col': 'Colossians', 'colossians': 'Colossians',
  '1 thess': '1 Thessalonians', '1thess': '1 Thessalonians', '1 thessalonians': '1 Thessalonians',
  '2 thess': '2 Thessalonians', '2thess': '2 Thessalonians', '2 thessalonians': '2 Thessalonians',
  '1 tim': '1 Timothy', '1tim': '1 Timothy', '1 timothy': '1 Timothy',
  '2 tim': '2 Timothy', '2tim': '2 Timothy', '2 timothy': '2 Timothy',
  'titus': 'Titus', 'tit': 'Titus',
  'phlm': 'Philemon', 'philemon': 'Philemon',
  'heb': 'Hebrews', 'hebrews': 'Hebrews',
  'jas': 'James', 'james': 'James',
  '1 pet': '1 Peter', '1pet': '1 Peter', '1 peter': '1 Peter',
  '2 pet': '2 Peter', '2pet': '2 Peter', '2 peter': '2 Peter',
  '1 jn': '1 John', '1john': '1 John', '1 john': '1 John',
  '2 jn': '2 John', '2john': '2 John', '2 john': '2 John',
  '3 jn': '3 John', '3john': '3 John', '3 john': '3 John',
  'jude': 'Jude',
  'rev': 'Revelation', 'revelation': 'Revelation'
};

// Bible book chapter counts for validation
const BOOK_CHAPTERS: Record<string, number> = {
  'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
  'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  'Ezra': 10, 'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalms': 150, 'Psalm': 150,
  'Proverbs': 31, 'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66,
  'Jeremiah': 52, 'Lamentations': 5, 'Ezekiel': 48, 'Daniel': 12,
  'Hosea': 14, 'Joel': 3, 'Amos': 9, 'Obadiah': 1, 'Jonah': 4, 'Micah': 7,
  'Nahum': 3, 'Habakkuk': 3, 'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4,
  'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28, 'Romans': 16,
  '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6, 'Ephesians': 6,
  'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
  '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1, 'Hebrews': 13,
  'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1, '3 John': 1,
  'Jude': 1, 'Revelation': 22
};

/**
 * Normalizes book name from various abbreviations and formats.
 */
export function normalizeBookName(bookInput: string): string {
  const normalized = bookInput.toLowerCase().trim();
  
  if (BOOK_ABBREVIATIONS[normalized]) {
    return BOOK_ABBREVIATIONS[normalized];
  }
  
  // Handle contaminated input from sanitization (e.g., "johnscriptalert...")
  // Check if it starts with a known book name
  for (const [abbrev, fullName] of Object.entries(BOOK_ABBREVIATIONS)) {
    if (normalized.startsWith(abbrev.toLowerCase()) && abbrev.length >= 3) {
      return fullName;
    }
  }
  
  // Try to find close matches for typos
  const closeMatches = Object.keys(BOOK_ABBREVIATIONS).filter(key => {
    // Exact match
    if (key === normalized) return true;
    
    // Handle common typos for John vs Jonah
    if (normalized === 'jon' && (key === 'jn' || key === 'john')) return true;
    
    // Handle other close matches
    return key.includes(normalized) || normalized.includes(key);
  });
  
  // Special case for "Jon" -> "John" instead of "Jonah"
  if (normalized === 'jon') {
    throw new Error(`Invalid book name: ${bookInput}. Did you mean "John"?`);
  }
  
  if (closeMatches.length === 1) {
    throw new Error(`Invalid book name: ${bookInput}. Did you mean "${BOOK_ABBREVIATIONS[closeMatches[0]]}"?`);
  }
  
  throw new Error(`Invalid book name: ${bookInput}`);
}

/**
 * Validates that a chapter/verse combination is valid for the given book.
 */
function validateChapterVerse(book: string, chapter: number, verse?: number): void {
  const maxChapters = BOOK_CHAPTERS[book];
  if (!maxChapters) {
    throw new Error(`Unknown book: ${book}`);
  }
  
  if (chapter < 1 || chapter > maxChapters) {
    if (maxChapters === 1) {
      throw new Error(`${book} only has 1 chapter`);
    } else {
      throw new Error(`${book} only has ${maxChapters} chapters`);
    }
  }
  
  if (verse !== undefined && verse !== null) {
    if (verse < 1) {
      throw new Error('Invalid verse number');
    }
    if (verse > 200) { // Reasonable upper limit
      throw new Error('Verse number too high');
    }
  }
}

/**
 * Parses a single Bible reference into its components.
 */
export function parseBibleReference(reference: string): ParsedReference {
  if (!reference || reference.trim() === '') {
    throw new Error('Reference cannot be empty');
  }
  
  // Sanitize input
  const sanitized = sanitizeBibleReference(reference);
  const cleaned = sanitized.trim().replace(/\s+/g, ' ');
  
  // Handle complex ranges with gaps (e.g., "Matthew 5:3-7, 10-12")
  if (cleaned.includes(',') && cleaned.match(/\d+:\d+-\d+,\s*\d+-\d+/)) {
    return parseComplexRange(cleaned);
  }
  
  // Handle cross-chapter ranges (e.g., "Romans 8:28-9:1")
  if (cleaned.match(/\d+:\d+-\d+:\d+/)) {
    return parseCrossChapterRange(cleaned);
  }
  
  // Handle different punctuation styles first
  let processedRef = cleaned
    .replace(/\s*[.]\s*/g, ':')  // "John 3.16" -> "John 3:16"
    .replace(/\s+verse\s+/gi, ':')  // "John 3 verse 16" -> "John 3:16"
    .replace(/\s+chapter\s+/gi, ' ')  // "John chapter 3 verse 16" -> "John 3:16"
    .replace(/\s*:\s*/g, ':')  // normalize colons
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')  // "John3:16" -> "John 3:16" (handle missing spaces)
    .replace(/\s+/g, ' ')  // normalize whitespace
    .trim();
  
  // Check for just book name without chapter/verse
  if (!processedRef.match(/\d/)) {
    throw new Error('Missing chapter or verse');
  }
  
  // Parse basic reference pattern
  const basicPattern = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/;
  const match = processedRef.match(basicPattern);
  
  if (!match) {
    if (processedRef.match(/\d+\s*[-–]\s*$/)) {
      throw new Error('Incomplete verse range');
    }
    throw new Error('Invalid reference format');
  }
  
  const [, bookPart, chapterStr, startVerseStr, endVerseStr] = match;
  
  const book = normalizeBookName(bookPart);
  const chapter = parseInt(chapterStr, 10);
  const startVerse = startVerseStr ? parseInt(startVerseStr, 10) : null;
  const endVerse = endVerseStr ? parseInt(endVerseStr, 10) : startVerse;
  
  if (chapter < 1) {
    throw new Error('Invalid chapter number');
  }
  
  if (startVerse !== null && startVerse < 1) {
    throw new Error('Invalid verse number');
  }
  
  if (endVerse !== null && startVerse !== null && endVerse < startVerse) {
    throw new Error('Invalid verse range order');
  }
  
  validateChapterVerse(book, chapter, startVerse || undefined);
  if (endVerse && endVerse !== startVerse) {
    validateChapterVerse(book, chapter, endVerse);
  }
  
  return {
    book,
    chapter,
    startVerse,
    endVerse,
    originalText: sanitized
  };
}

/**
 * Parses complex ranges with gaps (e.g., "Matthew 5:3-7, 10-12").
 */
function parseComplexRange(reference: string): ParsedReference {
  const parts = reference.split(/[,:]/);
  if (parts.length < 3) {
    throw new Error('Invalid complex range format');
  }
  
  const bookChapter = parts[0].trim();
  const bookChapterMatch = bookChapter.match(/^(.+?)\s+(\d+)$/);
  if (!bookChapterMatch) {
    throw new Error('Invalid book/chapter format');
  }
  
  const book = normalizeBookName(bookChapterMatch[1]);
  const chapter = parseInt(bookChapterMatch[2], 10);
  
  const verses: Array<{ start: number; end: number }> = [];
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    const rangeMatch = part.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!rangeMatch) {
      throw new Error(`Invalid verse range: ${part}`);
    }
    
    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : start;
    
    verses.push({ start, end });
  }
  
  validateChapterVerse(book, chapter);
  
  return {
    book,
    chapter,
    verses,
    originalText: sanitizeBibleReference(reference)
  };
}

/**
 * Parses cross-chapter ranges (e.g., "Romans 8:28-9:1").
 */
function parseCrossChapterRange(reference: string): ParsedReference {
  const match = reference.match(/^(.+?)\s+(\d+):(\d+)\s*[-–]\s*(\d+):(\d+)$/);
  if (!match) {
    throw new Error('Invalid cross-chapter range format');
  }
  
  const [, bookPart, startChapterStr, startVerseStr, endChapterStr, endVerseStr] = match;
  
  const book = normalizeBookName(bookPart);
  const startChapter = parseInt(startChapterStr, 10);
  const startVerse = parseInt(startVerseStr, 10);
  const endChapter = parseInt(endChapterStr, 10);
  const endVerse = parseInt(endVerseStr, 10);
  
  validateChapterVerse(book, startChapter, startVerse);
  validateChapterVerse(book, endChapter, endVerse);
  
  return {
    book,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
    originalText: sanitizeBibleReference(reference)
  };
}

/**
 * Parses multiple Bible references separated by semicolons or commas.
 */
export function parseMultipleReferences(references: string): ParsedReference[] {
  if (!references || references.trim() === '') {
    throw new Error('References cannot be empty');
  }
  
  // Handle semicolon-separated references (different books)
  if (references.includes(';')) {
    return references.split(';').map(ref => parseBibleReference(ref.trim()));
  }
  
  // Handle comma-separated references (potentially same book)
  if (references.includes(',')) {
    const parts = references.split(',');
    const results: ParsedReference[] = [];
    let currentBook = '';
    
    for (const part of parts) {
      const trimmed = part.trim();
      
      // Check if this part has a book name
      if (trimmed.match(/^[a-zA-Z]/)) {
        const parsed = parseBibleReference(trimmed);
        currentBook = parsed.book;
        results.push(parsed);
      } else {
        // This is likely just a chapter:verse, use the current book
        if (!currentBook) {
          throw new Error('Missing book name for reference: ' + trimmed);
        }
        const fullRef = `${currentBook} ${trimmed}`;
        results.push(parseBibleReference(fullRef));
      }
    }
    
    return results;
  }
  
  // Single reference
  return [parseBibleReference(references)];
}

/**
 * Validates if a Bible reference string is valid.
 */
export function validateBibleReference(reference: string): boolean {
  try {
    parseBibleReference(reference);
    return true;
  } catch {
    return false;
  }
}