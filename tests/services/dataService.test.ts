/**
 * DataService Tests
 * 
 * Tests for dual-write logic and sync operations
 */

import '@testing-library/jest-dom';
import { dataService, DuplicateVerseError, ValidationError } from '../../src/services/dataService';

// Mock the dependencies
jest.mock('../../src/services/localDb', () => ({
  localDb: {
    verses: {
      findByReference: jest.fn(),
      create: jest.fn(),
    },
    verseCards: {
      findByUserAndVerse: jest.fn(),
      create: jest.fn(),
      getByUser: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/supabase', () => ({
  db: {
    verses: {
      getByReference: jest.fn(),
      findOrCreate: jest.fn(),
    },
    verseCards: {
      create: jest.fn(),
    },
  },
  supabaseClient: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

jest.mock('../../src/services/esvApi', () => ({
  esvApi: {
    getPassage: jest.fn(),
  },
}));

jest.mock('../../src/utils/bibleRefParser', () => ({
  parseBibleReference: jest.fn(),
}));

// Import mocked modules
import { localDb } from '../../src/services/localDb';
import { db as supabaseDb, supabaseClient } from '../../src/services/supabase';
import { esvApi } from '../../src/services/esvApi';
import { parseBibleReference } from '../../src/utils/bibleRefParser';

const mockLocalDb = localDb as jest.Mocked<typeof localDb>;
const mockSupabaseDb = supabaseDb as jest.Mocked<typeof supabaseDb>;
const mockSupabaseClient = supabaseClient as jest.Mocked<typeof supabaseClient>;
const mockEsvApi = esvApi as jest.Mocked<typeof esvApi>;
const mockParseBibleReference = parseBibleReference as jest.MockedFunction<typeof parseBibleReference>;

describe('DataService', () => {
  const testUserId = 'test-user-123';
  const testReference = 'John 3:16';
  const testText = 'For God so loved the world...';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful mocks
    mockParseBibleReference.mockReturnValue({
      book: 'John',
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
      originalText: testReference
    });

    mockEsvApi.getPassage.mockResolvedValue({
      query: testReference,
      canonical: testReference,
      parsed: [['John', '3', '16']],
      passage_meta: [],
      passages: [testText]
    });
  });

  describe('addVerse', () => {
    test('successfully adds new verse with dual-write', async () => {
      // Setup: No existing verses
      mockLocalDb.verses.findByReference.mockResolvedValue(undefined);
      mockLocalDb.verseCards.findByUserAndVerse.mockResolvedValue(undefined);
      mockSupabaseDb.verses.getByReference.mockResolvedValue({ data: null, error: null });

      // Mock successful local creation
      const mockLocalVerse = {
        id: 'local-verse-id',
        reference: testReference,
        text: testText,
        translation: 'ESV',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockLocalCard = {
        id: 'local-card-id',
        user_id: testUserId,
        verse_id: 'local-verse-id',
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: '2024-01-01',
        archived: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        current_streak: 0,
        best_streak: 0
      };

      mockLocalDb.verses.create.mockResolvedValue(mockLocalVerse);
      mockLocalDb.verseCards.create.mockResolvedValue(mockLocalCard);

      // Mock successful remote creation
      const mockRemoteVerse = { ...mockLocalVerse, id: 'remote-verse-id' };
      const mockRemoteCard = { ...mockLocalCard, id: 'remote-card-id', verse_id: 'remote-verse-id' };

      mockSupabaseDb.verses.findOrCreate.mockResolvedValue({ data: mockRemoteVerse, error: null });
      mockSupabaseDb.verseCards.create.mockResolvedValue({ data: mockRemoteCard, error: null });

      const result = await dataService.addVerse(testReference, testUserId);

      expect(result.success).toBe(true);
      expect(result.local).toBeDefined();
      expect(result.remote).toBeDefined();
      expect(result.local?.verse.reference).toBe(testReference);
      expect(result.local?.verseCard.user_id).toBe(testUserId);
    });

    test('throws DuplicateVerseError when verse already exists locally', async () => {
      const existingVerse = {
        id: 'existing-verse-id',
        reference: testReference,
        text: testText,
        translation: 'ESV',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const existingCard = {
        id: 'existing-card-id',
        user_id: testUserId,
        verse_id: 'existing-verse-id',
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: '2024-01-01',
        archived: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        current_streak: 0,
        best_streak: 0
      };

      mockLocalDb.verses.findByReference.mockResolvedValue(existingVerse);
      mockLocalDb.verseCards.findByUserAndVerse.mockResolvedValue(existingCard);

      await expect(dataService.addVerse(testReference, testUserId))
        .rejects.toThrow(DuplicateVerseError);
    });

    test('throws ValidationError when ESV API returns no passages', async () => {
      mockLocalDb.verses.findByReference.mockResolvedValue(undefined);
      mockSupabaseDb.verses.getByReference.mockResolvedValue({ data: null, error: null });
      mockEsvApi.getPassage.mockResolvedValue({
        query: testReference,
        canonical: testReference,
        parsed: [],
        passage_meta: [],
        passages: [] // No passages found
      });

      await expect(dataService.addVerse(testReference, testUserId))
        .rejects.toThrow(ValidationError);
    });

    test('handles remote failure gracefully - local succeeds', async () => {
      // Setup: No existing verses
      mockLocalDb.verses.findByReference.mockResolvedValue(undefined);
      mockSupabaseDb.verses.getByReference.mockResolvedValue({ data: null, error: null });

      // Mock successful local creation
      const mockLocalVerse = {
        id: 'local-verse-id',
        reference: testReference,
        text: testText,
        translation: 'ESV',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockLocalCard = {
        id: 'local-card-id',
        user_id: testUserId,
        verse_id: 'local-verse-id',
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: '2024-01-01',
        archived: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        current_streak: 0,
        best_streak: 0
      };

      mockLocalDb.verses.create.mockResolvedValue(mockLocalVerse);
      mockLocalDb.verseCards.create.mockResolvedValue(mockLocalCard);

      // Mock remote failure
      mockSupabaseDb.verses.findOrCreate.mockRejectedValue(new Error('Network error'));

      const result = await dataService.addVerse(testReference, testUserId);

      expect(result.success).toBe(true);
      expect(result.local).toBeDefined();
      expect(result.remote).toBeNull();
      expect(result.errors.remote).toBeDefined();
      expect(result.errors.remote?.message).toContain('Failed to sync to remote database');
    });

    test('validates reference using bibleRefParser', async () => {
      mockParseBibleReference.mockImplementation(() => {
        throw new Error('Invalid reference format');
      });

      await expect(dataService.addVerse('Invalid Reference', testUserId))
        .rejects.toThrow('Invalid reference format');

      expect(mockParseBibleReference).toHaveBeenCalledWith('Invalid Reference');
    });
  });

  describe('syncToRemote', () => {
    test('syncs local cards to remote successfully', async () => {
      const localCards = [
        {
          id: 'local-card-1',
          user_id: testUserId,
          verse_id: 'verse-1',
          current_phase: 'daily' as const,
          phase_progress_count: 0,
          last_reviewed_at: null,
          next_due_date: '2024-01-01',
          archived: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          current_streak: 0,
          best_streak: 0
        }
      ];

      mockLocalDb.verseCards.getByUser.mockResolvedValue(localCards);

      // Mock that card doesn't exist remotely
      const mockFromMethod = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });
      mockSupabaseClient.from.mockReturnValue(mockFromMethod() as any);

      // Mock successful remote creation
      mockSupabaseDb.verseCards.create.mockResolvedValue({ data: localCards[0], error: null });

      const result = await dataService.syncToRemote(testUserId);

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    test('handles sync failures gracefully', async () => {
      const localCards = [
        {
          id: 'local-card-1',
          user_id: testUserId,
          verse_id: 'verse-1',
          current_phase: 'daily' as const,
          phase_progress_count: 0,
          last_reviewed_at: null,
          next_due_date: '2024-01-01',
          archived: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          current_streak: 0,
          best_streak: 0
        }
      ];

      mockLocalDb.verseCards.getByUser.mockResolvedValue(localCards);

      // Mock that card doesn't exist remotely
      const mockFromMethod = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });
      mockSupabaseClient.from.mockReturnValue(mockFromMethod() as any);

      // Mock failed remote creation
      mockSupabaseDb.verseCards.create.mockRejectedValue(new Error('Sync failed'));

      const result = await dataService.syncToRemote(testUserId);

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Sync failed');
    });
  });

  describe('getUserVerses', () => {
    test('returns user verses from local database', async () => {
      const mockCards = [
        {
          id: 'card-1',
          user_id: testUserId,
          verse_id: 'verse-1',
          current_phase: 'daily' as const,
          phase_progress_count: 0,
          last_reviewed_at: null,
          next_due_date: '2024-01-01',
          archived: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          current_streak: 0,
          best_streak: 0
        }
      ];

      const mockVerse = {
        id: 'verse-1',
        reference: 'John 3:16',
        text: 'For God so loved...',
        translation: 'ESV',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockLocalDb.verseCards.getByUser.mockResolvedValue(mockCards);
      mockLocalDb.verses.findByReference.mockResolvedValue(mockVerse);

      const result = await dataService.getUserVerses(testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].verse.reference).toBe('John 3:16');
      expect(result[0].verseCard.user_id).toBe(testUserId);
      expect(result[0].source).toBe('local');
    });

    test('handles empty results gracefully', async () => {
      mockLocalDb.verseCards.getByUser.mockResolvedValue([]);

      const result = await dataService.getUserVerses(testUserId);

      expect(result).toHaveLength(0);
    });
  });
});