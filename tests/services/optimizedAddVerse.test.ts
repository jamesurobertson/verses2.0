/**
 * Basic tests for optimized addVerse flow
 * Tests the 3-step logic without over-engineering database setup
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { dataService, DuplicateVerseError, ValidationError } from '../../src/services/dataService';
import { db } from '../../src/services/localDb';
import { supabaseClient } from '../../src/services/supabase';
import { esvApi } from '../../src/services/esvApi';

// Mock external dependencies
jest.mock('../../src/services/supabase');
jest.mock('../../src/services/esvApi');

const mockUserId = 'test-user-123';
const mockReference = 'jn 3:16';
const mockCanonicalRef = 'John 3:16';
const mockVerseText = 'For God so loved the world...';

describe('Optimized addVerse Flow', () => {
  beforeEach(async () => {
    // Clear local database before each test
    await db.transaction('rw', db.verses, db.aliases, db.verse_cards, async () => {
      await db.verses.clear();
      await db.aliases.clear();
      await db.verse_cards.clear();
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Step 1: Local Database Check', () => {
    it('should find verse by direct reference match', async () => {
      // Setup: Add verse to local database
      await db.transaction('rw', db.verses, async (tx) => {
        await tx.verses.add({
          id: 'verse-1',
          reference: mockReference,
          text: mockVerseText,
          translation: 'ESV',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });

      // Mock external calls (should not be used)
      const mockSupabaseCall = jest.fn();
      const mockEsvCall = jest.fn();
      (supabaseClient.from as jest.Mock).mockReturnValue({ select: mockSupabaseCall });
      (esvApi.getPassage as jest.Mock).mockImplementation(mockEsvCall);

      // Test
      const result = await dataService.addVerse(mockReference, mockUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.local?.verse.reference).toBe(mockReference);
      expect(mockSupabaseCall).not.toHaveBeenCalled();
      expect(mockEsvCall).not.toHaveBeenCalled();
    });

    it('should find verse by alias lookup', async () => {
      // Setup: Add verse and alias to local database
      await db.transaction('rw', db.verses, db.aliases, async (tx) => {
        await tx.verses.add({
          id: 'verse-1',
          reference: mockCanonicalRef,
          text: mockVerseText,
          translation: 'ESV',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await tx.aliases.add({
          id: 'alias-1',
          alias: 'jn 3:16',
          verse_id: 'verse-1',
          created_at: new Date().toISOString()
        });
      });

      // Test
      const result = await dataService.addVerse('jn 3:16', mockUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.local?.verse.reference).toBe(mockCanonicalRef);
    });

    it('should throw DuplicateVerseError for active verse_card', async () => {
      // Setup: Add verse and active verse_card
      await db.transaction('rw', db.verses, db.verse_cards, async (tx) => {
        await tx.verses.add({
          id: 'verse-1',
          reference: mockReference,
          text: mockVerseText,
          translation: 'ESV',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await tx.verse_cards.add({
          id: 'card-1',
          user_id: mockUserId,
          verse_id: 'verse-1',
          current_phase: 'daily',
          phase_progress_count: 0,
          last_reviewed_at: null,
          next_due_date: '2024-01-01',
          assigned_day_of_week: null,
          assigned_week_parity: null,
          assigned_day_of_month: null,
          archived: false,
          current_streak: 0,
          best_streak: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });

      // Test
      await expect(dataService.addVerse(mockReference, mockUserId))
        .rejects.toThrow(DuplicateVerseError);
    });

    it('should restore archived verse_card', async () => {
      // Setup: Add verse and archived verse_card
      await db.transaction('rw', db.verses, db.verse_cards, async (tx) => {
        await tx.verses.add({
          id: 'verse-1',
          reference: mockReference,
          text: mockVerseText,
          translation: 'ESV',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await tx.verse_cards.add({
          id: 'card-1',
          user_id: mockUserId,
          verse_id: 'verse-1',
          current_phase: 'weekly',
          phase_progress_count: 5,
          last_reviewed_at: '2024-01-01T12:00:00Z',
          next_due_date: '2024-01-10',
          assigned_day_of_week: 3,
          assigned_week_parity: 1,
          assigned_day_of_month: null,
          archived: true, // Archived
          current_streak: 10,
          best_streak: 15,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });

      // Test
      const result = await dataService.addVerse(mockReference, mockUserId);

      // Verify restoration
      expect(result.success).toBe(true);
      expect(result.local?.verseCard.archived).toBe(false);
      expect(result.local?.verseCard.current_phase).toBe('daily');
      expect(result.local?.verseCard.phase_progress_count).toBe(0);
      expect(result.local?.verseCard.current_streak).toBe(0);
      expect(result.local?.verseCard.assigned_day_of_week).toBe(null);
    });
  });

  describe('Step 3: ESV API Fallback', () => {
    it('should call ESV API when verse not found locally or remotely', async () => {
      // Mock Supabase responses (not found)
      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            })
          })
        })
      });

      // Mock ESV API response
      (esvApi.getPassage as jest.Mock).mockResolvedValue({
        canonical: mockCanonicalRef,
        passages: [mockVerseText]
      });

      // Test
      const result = await dataService.addVerse(mockReference, mockUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.local?.verse.reference).toBe(mockCanonicalRef);
      expect(result.local?.verse.text).toBe(mockVerseText);
      expect(esvApi.getPassage).toHaveBeenCalledWith(mockReference);

      // Verify alias was created
      const aliasRecord = await db.aliases
        .where('alias')
        .equals('jn 3:16')
        .first();
      expect(aliasRecord).toBeTruthy();
      expect(aliasRecord?.verse_id).toBe(result.local?.verse.id);
    });

    it('should throw ValidationError when ESV API returns no passages', async () => {
      // Mock Supabase responses (not found)
      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            })
          })
        })
      });

      // Mock ESV API response (no passages)
      (esvApi.getPassage as jest.Mock).mockResolvedValue({
        canonical: mockCanonicalRef,
        passages: []
      });

      // Test
      await expect(dataService.addVerse(mockReference, mockUserId))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('Alias Management', () => {
    it('should create alias when verse exists but alias does not', async () => {
      // Setup: Add verse without the alias
      await db.transaction('rw', db.verses, async (tx) => {
        await tx.verses.add({
          id: 'verse-1',
          reference: mockCanonicalRef,
          text: mockVerseText,
          translation: 'ESV',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });

      // Test with different reference format
      const result = await dataService.addVerse('jn 3:16', mockUserId);

      // Verify alias was created
      const aliasRecord = await db.aliases
        .where('alias')
        .equals('jn 3:16')
        .first();
      
      expect(aliasRecord).toBeTruthy();
      expect(aliasRecord?.verse_id).toBe('verse-1');
      expect(result.success).toBe(true);
    });

    it('should not create duplicate alias', async () => {
      // Setup: Add verse and existing alias
      await db.transaction('rw', db.verses, db.aliases, async (tx) => {
        await tx.verses.add({
          id: 'verse-1',
          reference: mockCanonicalRef,
          text: mockVerseText,
          translation: 'ESV',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await tx.aliases.add({
          id: 'alias-1',
          alias: 'jn 3:16',
          verse_id: 'verse-1',
          created_at: new Date().toISOString()
        });
      });

      // Test
      const result = await dataService.addVerse('jn 3:16', mockUserId);

      // Verify only one alias exists
      const aliasRecords = await db.aliases
        .where('alias')
        .equals('jn 3:16')
        .toArray();
      
      expect(aliasRecords).toHaveLength(1);
      expect(result.success).toBe(true);
    });
  });
});