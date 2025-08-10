/**
 * Tests for batch verse parser
 * Handles parsing user input into individual verse card requests
 */

import { parseBatchVerseInput, type BatchParseResult, type VerseCardRequest } from './batchVerseParser';

describe('batchVerseParser', () => {
  describe('Single verse parsing', () => {
    it('should parse a single verse reference', () => {
      const input = 'John 3:16';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]).toEqual({
        id: expect.any(String),
        reference: 'John 3:16',
        normalizedReference: 'john 3:16'
      });
    });

    it('should parse comma-separated verses from same chapter', () => {
      const input = 'John 5:10,15,19,20';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]).toEqual({
        id: expect.any(String),
        reference: 'John 5:10,15,19,20',
        normalizedReference: 'john 5:10,15,19,20'
      });
    });
  });

  describe('Multiple card parsing', () => {
    it('should split on semicolons for clear card boundaries', () => {
      const input = 'John 3:16; Romans 8:28; 1 Peter 2:3';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('John 3:16');
      expect(result.cards[1].reference).toBe('Romans 8:28');
      expect(result.cards[2].reference).toBe('1 Peter 2:3');
    });

    it('should split on commas when different books are detected', () => {
      const input = 'John 3:16, Romans 8:28, 1 Peter 2:3';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('John 3:16');
      expect(result.cards[1].reference).toBe('Romans 8:28');
      expect(result.cards[2].reference).toBe('1 Peter 2:3');
    });

    it('should keep comma-separated verses from same chapter together', () => {
      const input = 'John 5:1,5,10, Romans 8:28, 1 Peter 2:3';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('John 5:1,5,10');
      expect(result.cards[1].reference).toBe('Romans 8:28');
      expect(result.cards[2].reference).toBe('1 Peter 2:3');
    });
  });

  describe('Complex mixed formats', () => {
    it('should handle mixed semicolons and commas', () => {
      const input = 'John 5:1,5,10; Romans 8:28, 1 Peter 2:3; Matthew 5:3,4';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(4);
      expect(result.cards[0].reference).toBe('John 5:1,5,10');
      expect(result.cards[1].reference).toBe('Romans 8:28');
      expect(result.cards[2].reference).toBe('1 Peter 2:3');
      expect(result.cards[3].reference).toBe('Matthew 5:3,4');
    });

    it('should handle numbered books correctly', () => {
      const input = '1 John 3:16, 2 Timothy 3:16, 1 Peter 2:3';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('1 John 3:16');
      expect(result.cards[1].reference).toBe('2 Timothy 3:16');
      expect(result.cards[2].reference).toBe('1 Peter 2:3');
    });

    it('should handle numbered books with abbreviations', () => {
      const input = '1 Pet 2:3, 2 Pet 3:9, 1 Cor 13:4';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('1 Pet 2:3');
      expect(result.cards[1].reference).toBe('2 Pet 3:9');
      expect(result.cards[2].reference).toBe('1 Cor 13:4');
    });

    it('should handle mixed numbered and non-numbered books', () => {
      const input = 'John 3:16, 1 John 3:16, 2 John 1:3, 3 John 1:2';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(4);
      expect(result.cards[0].reference).toBe('John 3:16');
      expect(result.cards[1].reference).toBe('1 John 3:16');
      expect(result.cards[2].reference).toBe('2 John 1:3');
      expect(result.cards[3].reference).toBe('3 John 1:2');
    });

    it('should handle Old Testament numbered books', () => {
      const input = '1 Kings 8:9, 2 Kings 2:11, 1 Chronicles 16:34, 2 Chronicles 7:14';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(4);
      expect(result.cards[0].reference).toBe('1 Kings 8:9');
      expect(result.cards[1].reference).toBe('2 Kings 2:11');
      expect(result.cards[2].reference).toBe('1 Chronicles 16:34');
      expect(result.cards[3].reference).toBe('2 Chronicles 7:14');
    });

    it('should distinguish between verse numbers and book numbers', () => {
      // This is the tricky case: "John 5:1, 1 Peter 2:3"
      const input = 'John 5:1, 1 Peter 2:3';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].reference).toBe('John 5:1');
      expect(result.cards[1].reference).toBe('1 Peter 2:3');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle empty input', () => {
      const result = parseBatchVerseInput('');
      expect(result.cards).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      const result = parseBatchVerseInput('   ');
      expect(result.cards).toHaveLength(0);
    });

    it('should trim whitespace from references', () => {
      const input = '  John 3:16  ;  Romans 8:28  ';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].reference).toBe('John 3:16');
      expect(result.cards[1].reference).toBe('Romans 8:28');
    });

    it('should filter out empty segments', () => {
      const input = 'John 3:16;; Romans 8:28; ; 1 Peter 2:3';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('John 3:16');
      expect(result.cards[1].reference).toBe('Romans 8:28');
      expect(result.cards[2].reference).toBe('1 Peter 2:3');
    });
  });

  describe('Normalization for aliases', () => {
    it('should normalize references for alias creation', () => {
      const input = 'Jn 3:16; Rom 8:28';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(2);
      expect(result.cards[0]).toEqual({
        id: expect.any(String),
        reference: 'Jn 3:16',
        normalizedReference: 'john 3:16'
      });
      expect(result.cards[1]).toEqual({
        id: expect.any(String),
        reference: 'Rom 8:28',
        normalizedReference: 'rom 8:28'
      });
    });

    it('should handle complex reference formats for normalization', () => {
      const input = '1 Cor 13:4-7; Ps 23:1,4; Mt 5:3,4';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].normalizedReference).toBe('1 cor 13:4-7');
      expect(result.cards[1].normalizedReference).toBe('ps 23:1,4');
      expect(result.cards[2].normalizedReference).toBe('mt 5:3,4');
    });
  });

  describe('Book boundary detection', () => {
    it('should detect book boundaries with common abbreviations', () => {
      const input = 'Jn 3:16, Rom 8:28, 1 Pet 2:3';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('Jn 3:16');
      expect(result.cards[1].reference).toBe('Rom 8:28');
      expect(result.cards[2].reference).toBe('1 Pet 2:3');
    });

    it('should not split verses from same book/chapter', () => {
      const input = 'John 5:1, 5, 10, 15';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].reference).toBe('John 5:1,5,10,15');
    });

    it('should handle mixed full names and abbreviations', () => {
      const input = 'John 3:16, Rom 8:28, First Peter 2:3';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('John 3:16');
      expect(result.cards[1].reference).toBe('Rom 8:28');
      expect(result.cards[2].reference).toBe('First Peter 2:3');
    });
  });

  describe('Real-world examples', () => {
    it('should handle the example from requirements', () => {
      const input = 'john 5:15, john 3:39, galatians 2:1-4; galatians 2:5-8, revelation 1:1';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(5);
      expect(result.cards[0].reference).toBe('john 5:15');
      expect(result.cards[1].reference).toBe('john 3:39');
      expect(result.cards[2].reference).toBe('galatians 2:1-4');
      expect(result.cards[3].reference).toBe('galatians 2:5-8');
      expect(result.cards[4].reference).toBe('revelation 1:1');
    });

    it('should handle verse ranges correctly', () => {
      const input = 'Psalm 23:1-6; John 14:1-3; Romans 8:28-30';
      const result = parseBatchVerseInput(input);
      
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0].reference).toBe('Psalm 23:1-6');
      expect(result.cards[1].reference).toBe('John 14:1-3');
      expect(result.cards[2].reference).toBe('Romans 8:28-30');
    });
  });
});