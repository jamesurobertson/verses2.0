// TDD Step 1: RED - Write failing tests FIRST for Bible reference parsing
import { 
  parseBibleReference, 
  parseMultipleReferences, 
  validateBibleReference,
  normalizeBookName,
  ParsedReference
} from '../../src/utils/bibleRefParser';

describe('Bible Reference Parser (TDD)', () => {
  // These functions don't exist yet - this should fail!
  
  describe('Basic Reference Parsing', () => {
    test('should parse simple reference correctly', () => {
      const result = parseBibleReference('John 3:16');
      console.log('result', result);
      expect(result).toEqual({
        book: 'John',
        chapter: 3,
        startVerse: 16,
        endVerse: null,
        originalText: 'John 3:16'
      });
    });

    test('should parse chapter only reference', () => {
      const result = parseBibleReference('Psalm 23');
      expect(result).toEqual({
        book: 'Psalm',
        chapter: 23,
        startVerse: null,
        endVerse: null,
        originalText: 'Psalm 23'
      });
    });

    test('should parse verse range within chapter', () => {
      const result = parseBibleReference('John 3:16-18');
      expect(result).toEqual({
        book: 'John',
        chapter: 3,
        startVerse: 16,
        endVerse: 18,
        originalText: 'John 3:16-18'
      });
    });
  });

  describe('Complex Range Parsing', () => {
    test('should parse verse ranges with gaps', () => {
      const result = parseBibleReference('Matthew 5:3-7, 10-12');
      expect(result).toEqual({
        book: 'Matthew',
        chapter: 5,
        verses: [
          { start: 3, end: 7 },
          { start: 10, end: 12 }
        ],
        originalText: 'Matthew 5:3-7, 10-12'
      });
    });

    test('should parse cross-chapter ranges', () => {
      const result = parseBibleReference('Romans 8:28-9:1');
      expect(result).toEqual({
        book: 'Romans',
        startChapter: 8,
        startVerse: 28,
        endChapter: 9,
        endVerse: 1,
        originalText: 'Romans 8:28-9:1'
      });
    });
  });

  describe('Book Name Abbreviations', () => {
    test('should handle common abbreviations', () => {
      const testCases = [
        { input: 'Mt 5:1', expected: 'Matthew' },
        { input: 'Mk 1:1', expected: 'Mark' },
        { input: 'Lk 2:1', expected: 'Luke' },
        { input: 'Jn 3:16', expected: 'John' },
        { input: 'Rom 8:28', expected: 'Romans' },
        { input: '1 Cor 13:4', expected: '1 Corinthians' },
        { input: '2 Tim 3:16', expected: '2 Timothy' },
        { input: 'Phil 4:13', expected: 'Philippians' },
        { input: 'Rev 21:4', expected: 'Revelation' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseBibleReference(input);
        expect(result.book).toBe(expected);
      });
    });

    test('should normalize book names correctly', () => {
      expect(normalizeBookName('mt')).toBe('Matthew');
      expect(normalizeBookName('JOHN')).toBe('John');
      expect(normalizeBookName('1 corinthians')).toBe('1 Corinthians');
      expect(normalizeBookName('2tim')).toBe('2 Timothy');
    });
  });

  describe('Multiple References', () => {
    test('should parse semicolon-separated references', () => {
      const result = parseMultipleReferences('Romans 8:28; Philippians 4:13; John 3:16');
      expect(result).toHaveLength(3);
      expect(result[0].book).toBe('Romans');
      expect(result[1].book).toBe('Philippians');
      expect(result[2].book).toBe('John');
    });

    test('should parse comma-separated references with same book', () => {
      const result = parseMultipleReferences('John 3:16, 14:6, 11:25');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        book: 'John',
        chapter: 3,
        startVerse: 16,
        endVerse: null,
        originalText: 'John 3:16'
      });
      expect(result[1]).toEqual({
        book: 'John',
        chapter: 14,
        startVerse: 6,
        endVerse: null,
        originalText: 'John 14:6'
      });
      expect(result[2]).toEqual({
        book: 'John',
        chapter: 11,
        startVerse: 25,
        endVerse: null,
        originalText: 'John 11:25'
      });
    });
  });

  describe('Validation and Error Handling', () => {
    test('should validate correct Bible references', () => {
      expect(validateBibleReference('John 3:16')).toBe(true);
      expect(validateBibleReference('Romans 8:28-30')).toBe(true);
      expect(validateBibleReference('1 Corinthians 13')).toBe(true);
    });

    test('should reject invalid book names', () => {
      expect(() => parseBibleReference('Fake 1:1')).toThrow('Invalid book name: Fake');
      expect(() => parseBibleReference('4 John 1:1')).toThrow('Invalid book name: 4 John');
    });

    test('should reject invalid chapter/verse numbers', () => {
      expect(() => parseBibleReference('John 0:1')).toThrow('Invalid chapter number');
      expect(() => parseBibleReference('John 1:0')).toThrow('Invalid verse number');
      expect(() => parseBibleReference('John 1:999')).toThrow('Verse number too high');
    });

    test('should reject malformed references', () => {
      expect(() => parseBibleReference('')).toThrow('Reference cannot be empty');
      expect(() => parseBibleReference('John')).toThrow('Missing chapter or verse');
      expect(() => parseBibleReference('John 3:16-')).toThrow('Incomplete verse range');
      expect(() => parseBibleReference('John 3:16-10')).toThrow('Invalid verse range order');
    });

    test('should provide helpful error messages', () => {
      try {
        parseBibleReference('Jon 3:16');
      } catch (error) {
        expect(error.message).toContain('Did you mean "John"?');
      }

      try {
        parseBibleReference('1 John 6:1'); // 1 John only has 5 chapters
      } catch (error) {
        expect(error.message).toContain('1 John only has 5 chapters');
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle extra whitespace', () => {
      const result = parseBibleReference('  John   3 : 16  ');
      expect(result.book).toBe('John');
      expect(result.chapter).toBe(3);
      expect(result.startVerse).toBe(16);
    });

    test('should handle different punctuation styles', () => {
      const testCases = [
        'John 3:16',
        'John 3.16',
        'John 3 verse 16',
        'John chapter 3 verse 16'
      ];

      testCases.forEach(input => {
        const result = parseBibleReference(input);
        expect(result.book).toBe('John');
        expect(result.chapter).toBe(3);
        expect(result.startVerse).toBe(16);
      });
    });

    test('should handle single chapter books', () => {
      const result = parseBibleReference('Obadiah 1:10');
      expect(result.book).toBe('Obadiah');
      expect(result.chapter).toBe(1);
      expect(result.startVerse).toBe(10);
    });

    test('should handle books with numbers', () => {
      const result = parseBibleReference('1 Kings 17:1');
      expect(result.book).toBe('1 Kings');
      expect(result.chapter).toBe(17);
      expect(result.startVerse).toBe(1);
    });
  });

  describe('Performance and Security', () => {
    test('should handle reasonably long input without crashing', () => {
      const longRef = 'A'.repeat(1000);
      expect(() => parseBibleReference(longRef)).toThrow();
    });

    test('should sanitize input to prevent injection attacks', () => {
      const maliciousInput = 'John<script>alert("xss")</script>3:16';
      const result = parseBibleReference(maliciousInput);
      expect(result.originalText).not.toContain('<script>');
    });
  });
});