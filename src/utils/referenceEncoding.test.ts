/**
 * Reference URL Encoding/Decoding Tests
 * 
 * Tests for safe encoding of Bible references for URLs and decoding them back.
 * Based on research of how major Bible websites handle URL encoding:
 * - BibleGateway: Uses query parameters with + for spaces
 * - ESV.org: Uses + for spaces, preserves ranges  
 * - YouVersion: Uses structured book.chapter.verse format
 * - Blue Letter Bible: Uses abbreviated book codes
 * - BibleHub: Uses underscores and preserves ranges
 */

import { encodeReference, decodeReference, normalizeReference } from './referenceEncoding';

describe('Reference Encoding/Decoding', () => {
  
  describe('Single Verses', () => {
    test('should handle basic single verse', () => {
      const reference = 'John 3:16';
      const encoded = encodeReference(reference);
      const decoded = decodeReference(encoded);
      
      expect(decoded.toLowerCase()).toContain('john');
      expect(decoded).toContain('3:16');
    });

    test('should handle numbered books - single verse', () => {
      const reference = '1 John 3:16';
      const encoded = encodeReference(reference);
      const decoded = decodeReference(encoded);
      
      expect(decoded.toLowerCase()).toContain('1 john');
      expect(decoded).toContain('3:16');
    });

    test('should handle 2nd and 3rd numbered books', () => {
      const cases = [
        '2 Corinthians 5:17',
        '3 John 1:14',
        '1 Timothy 2:5',
        '2 Timothy 3:16',
        '1 Peter 5:7',
        '2 Peter 1:3'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should preserve the number and book name
        expect(decoded.toLowerCase()).toContain(reference.split(' ')[0].toLowerCase());
        expect(decoded.toLowerCase()).toContain(reference.split(' ')[1].toLowerCase());
      });
    });

    test('should handle multi-word books', () => {
      const cases = [
        'Song of Solomon 2:1',
        'Acts of the Apostles 2:38', // Some translations use this full name
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should contain the main parts of the book name
        const words = reference.split(' ');
        const chapter = words[words.length - 1];
        expect(decoded).toContain(chapter);
      });
    });
  });

  describe('Verse Ranges', () => {
    test('should handle simple verse ranges', () => {
      const reference = 'John 3:16-17';
      const encoded = encodeReference(reference);
      const decoded = decodeReference(encoded);
      
      expect(decoded.toLowerCase()).toContain('john');
      expect(decoded).toContain('3:16-17');
    });

    test('should handle complex verse ranges', () => {
      const cases = [
        'Romans 8:28-39',
        'Psalm 23:1-6',
        '1 Corinthians 13:4-8',  // The problematic case from the issue
        '2 Timothy 3:16-17',
        'Ephesians 2:8-10',
        'John 14:1-3',
        'Matthew 5:3-12'  // Longer range
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Extract expected parts
        const parts = reference.split(' ');
        const chapterVerse = parts[parts.length - 1];
        const [chapter, verseRange] = chapterVerse.split(':');
        
        expect(decoded).toContain(`:${verseRange}`);
        expect(decoded).toContain(chapter);
      });
    });

    test('should handle cross-chapter ranges', () => {
      const cases = [
        'Genesis 1:1-2:3',
        'Luke 23:50-24:12',
        '1 Kings 17:1-18:46'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should preserve the range structure
        expect(decoded).toMatch(/\d+:\d+-\d+:\d+/);
      });
    });

    test('should handle multiple verse selections', () => {
      const cases = [
        'Romans 3:23,6:23',
        'John 3:16,14:6',
        '1 John 1:9,4:19',
        'Ephesians 2:8,4:32,6:10'  // Multiple selections
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should preserve comma-separated structure
        expect(decoded).toContain(',');
      });
    });
  });

  describe('Chapter Only References', () => {
    test('should handle chapter-only references', () => {
      const cases = [
        'Psalm 23',
        'John 3',
        '1 Corinthians 13',
        'Romans 8',
        'Genesis 1'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        const parts = reference.split(' ');
        const chapter = parts[parts.length - 1];
        expect(decoded).toContain(chapter);
        expect(decoded).not.toContain(':');
      });
    });
  });

  describe('Book Only References', () => {
    test('should handle book-only references', () => {
      const cases = [
        'Genesis',
        'Revelation',
        'Philemon',
        '1 John',
        '2 Timothy',
        'Song of Solomon'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should not contain chapter or verse indicators
        expect(decoded).not.toContain(':');
        expect(decoded).not.toMatch(/\d+$/); // No trailing numbers
      });
    });
  });

  describe('Multiple Reference Groups', () => {
    test('should handle semicolon-separated groups', () => {
      const cases = [
        'John 3:16; Romans 8:28',
        '1 Corinthians 13:4-8; Romans 12:9-21',
        'Genesis 1:1; John 1:1; Revelation 22:21',
        'Psalm 23; Psalm 91; Psalm 139'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        expect(decoded).toContain(';');
        // Count should match
        const originalGroups = reference.split(';').length;
        const decodedGroups = decoded.split(';').length;
        expect(decodedGroups).toBe(originalGroups);
      });
    });
  });

  describe('Edge Cases and Special Characters', () => {
    test('should handle references with extra whitespace', () => {
      const cases = [
        '  John 3:16  ',
        'Romans   8:28',
        '1  Corinthians  13:4-8',
        'Psalm 23 ; Romans 8:28'  // Space around semicolon
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should handle gracefully without extra spaces in output
        expect(decoded).not.toMatch(/\s{2,}/); // No double spaces
        expect(decoded.trim()).toBe(decoded); // No leading/trailing spaces
      });
    });

    test('should handle mixed case input', () => {
      const cases = [
        'JOHN 3:16',
        'john 3:16',
        'JoHn 3:16',
        '1 CORINTHIANS 13:4-8',
        'psalM 23'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should produce properly capitalized output
        expect(decoded).toMatch(/^[A-Z]/); // Starts with capital
      });
    });

    test('should handle empty and invalid inputs', () => {
      const cases = ['', '   ', null, undefined];

      cases.forEach(reference => {
        const encoded = encodeReference(reference as string);
        const decoded = decodeReference(encoded);
        
        expect(decoded).toBe('');
      });
    });

    test('should handle references with periods', () => {
      const cases = [
        'Matt. 5:16',  // Abbreviated with period
        '1 Cor. 13:13',
        'Gen. 1:1'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should handle periods gracefully
        expect(encoded).not.toContain('.');
        expect(decoded).toBeDefined();
      });
    });
  });

  describe('Common Problematic Cases', () => {
    test('should correctly handle the reported bug case', () => {
      const reference = '1 Corinthians 13:4-8';
      const encoded = encodeReference(reference);
      const decoded = decodeReference(encoded);
      
      // This is the specific case reported as broken
      expect(decoded.toLowerCase()).toContain('1 corinthians');
      expect(decoded).toContain('13:4-8');
      expect(decoded).not.toContain('13:48'); // Should not be corrupted
      expect(decoded).not.toBe('1 Corinthians 13:13'); // Should not be wrong
    });

    test('should handle other similar problematic patterns', () => {
      const cases = [
        '2 Corinthians 4:16-18',
        '1 Timothy 6:6-8', 
        '2 Peter 1:3-4',
        '1 Peter 2:9-10',
        '3 John 1:2-4'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        // Should preserve the range correctly
        const originalRange = reference.split(':')[1];
        expect(decoded).toContain(`:${originalRange}`);
      });
    });
  });

  describe('URL Safety', () => {
    test('encoded references should be URL-safe', () => {
      const cases = [
        'John 3:16',
        '1 Corinthians 13:4-8',
        'Song of Solomon 2:1',
        'John 3:16; Romans 8:28',
        'Genesis 1:1-2:3'
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        
        // Should not contain URL-unsafe characters
        expect(encoded).not.toMatch(/[\s:;,]/);
        expect(encoded).not.toMatch(/[^\w\-._~]/);
        
        // Should be decodeable
        const decoded = decodeReference(encoded);
        expect(decoded).toBeDefined();
        expect(decoded.length).toBeGreaterThan(0);
      });
    });

    test('should produce consistent encoding/decoding', () => {
      const cases = [
        'John 3:16',
        '1 Corinthians 13:4-8',
        'Psalm 23',
        'Genesis 1:1-2:3',
        'John 3:16; Romans 8:28'
      ];

      cases.forEach(reference => {
        const encoded1 = encodeReference(reference);
        const decoded1 = decodeReference(encoded1);
        const encoded2 = encodeReference(decoded1);
        const decoded2 = decodeReference(encoded2);
        
        // Multiple encode/decode cycles should be stable
        expect(decoded1.toLowerCase().replace(/\s+/g, ' ').trim())
          .toBe(decoded2.toLowerCase().replace(/\s+/g, ' ').trim());
      });
    });
  });

  describe('Normalization', () => {
    test('should normalize common variations', () => {
      const cases = [
        { input: '1st John 3:16', expected: '1 John 3:16' },
        { input: '2nd Corinthians 5:17', expected: '2 Corinthians 5:17' },
        { input: 'First John 4:19', expected: '1 John 4:19' },
        { input: 'Second Timothy 3:16', expected: '2 Timothy 3:16' },
      ];

      cases.forEach(({ input, expected }) => {
        const normalized = normalizeReference(input);
        const encoded = encodeReference(normalized);
        const decoded = decodeReference(encoded);
        
        // Should handle common variations
        expect(decoded.toLowerCase()).toContain(expected.split(' ')[1].toLowerCase());
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle very long references', () => {
      const longReference = 'Genesis 1:1-50; Exodus 1:1-22; Leviticus 1:1-17; Numbers 1:1-54; Deuteronomy 1:1-46';
      const encoded = encodeReference(longReference);
      const decoded = decodeReference(encoded);
      
      expect(decoded).toContain('Genesis');
      expect(decoded).toContain('Deuteronomy');
      expect(decoded.split(';')).toHaveLength(5);
    });

    test('should handle unusual but valid formats', () => {
      const cases = [
        'Jude 1',        // Single chapter book with explicit chapter
        'Obadiah 1',     // Another single chapter book
        'Philemon 1',    // Single chapter book
        'Psalm 119:1-176' // Very long chapter
      ];

      cases.forEach(reference => {
        const encoded = encodeReference(reference);
        const decoded = decodeReference(encoded);
        
        expect(decoded).toBeDefined();
        expect(decoded.length).toBeGreaterThan(0);
      });
    });
  });
});