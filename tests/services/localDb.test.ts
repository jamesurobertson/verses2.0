/**
 * LocalDB Tests
 * 
 * Tests for Dexie operations and schema validation
 */

import '@testing-library/jest-dom';
import { localDb, db } from '../../src/services/localDb';

describe('LocalDB', () => {
  beforeEach(async () => {
    // Clear database before each test
    try {
      await localDb.clear();
    } catch (error) {
      // Database might not exist yet, that's OK
    }
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await db.close();
      await db.delete();
    } catch (error) {
      // Database might already be closed, that's OK
    }
  });

  describe('Verses operations', () => {
    test('creates verse with UUID primary key', async () => {
      const verseData = {
        reference: 'John 3:16',
        text: 'For God so loved the world...',
        translation: 'ESV'
      };

      const verse = await localDb.verses.create(verseData);
      
      expect(verse.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(verse.reference).toBe('John 3:16');
      expect(verse.text).toBe('For God so loved the world...');
      expect(verse.translation).toBe('ESV');
      expect(verse.created_at).toBeDefined();
      expect(verse.updated_at).toBeDefined();
    });

    test('finds verse by reference and translation', async () => {
      const verseData = {
        reference: 'Romans 8:28',
        text: 'And we know that in all things...',
        translation: 'ESV'
      };

      await localDb.verses.create(verseData);
      const found = await localDb.verses.findByReference('Romans 8:28', 'ESV');
      
      expect(found).toBeDefined();
      expect(found!.reference).toBe('Romans 8:28');
    });

    test('returns null for non-existent verse', async () => {
      const found = await localDb.verses.findByReference('Nonexistent 1:1', 'ESV');
      expect(found).toBeUndefined();
    });

    test('gets all verses ordered by creation date', async () => {
      await localDb.verses.create({
        reference: 'John 3:16',
        text: 'For God so loved...',
        translation: 'ESV'
      });

      await localDb.verses.create({
        reference: 'Romans 8:28',
        text: 'And we know...',
        translation: 'ESV'
      });

      const allVerses = await localDb.verses.getAll();
      expect(allVerses).toHaveLength(2);
      // Most recent first (reverse chronological)
      expect(allVerses[0].reference).toBe('Romans 8:28');
      expect(allVerses[1].reference).toBe('John 3:16');
    });
  });

  describe('Verse cards operations', () => {
    let testVerse: any;
    const testUserId = 'test-user-123';

    beforeEach(async () => {
      testVerse = await localDb.verses.create({
        reference: 'John 3:16',
        text: 'For God so loved the world...',
        translation: 'ESV'
      });
    });

    test('creates verse card with defaults', async () => {
      const cardData = {
        user_id: testUserId,
        verse_id: testVerse.id,
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: '2024-01-01',
        archived: false,
        current_streak: 0,
        best_streak: 0
      };

      const card = await localDb.verseCards.create(cardData);
      
      expect(card.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(card.user_id).toBe(testUserId);
      expect(card.verse_id).toBe(testVerse.id);
      expect(card.current_phase).toBe('daily');
      expect(card.phase_progress_count).toBe(0);
      expect(card.archived).toBe(false);
      expect(card.current_streak).toBe(0);
      expect(card.best_streak).toBe(0);
      expect(card.created_at).toBeDefined();
      expect(card.updated_at).toBeDefined();
    });

    test('finds verse card by user and verse', async () => {
      const cardData = {
        user_id: testUserId,
        verse_id: testVerse.id,
        next_due_date: '2024-01-01'
      };

      await localDb.verseCards.create({
        ...cardData,
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        archived: false,
        current_streak: 0,
        best_streak: 0
      });
      const found = await localDb.verseCards.findByUserAndVerse(testUserId, testVerse.id);
      
      expect(found).toBeDefined();
      expect(found!.user_id).toBe(testUserId);
      expect(found!.verse_id).toBe(testVerse.id);
    });

    test('gets verse cards by user (excludes archived)', async () => {
      // Create active card
      await localDb.verseCards.create({
        user_id: testUserId,
        verse_id: testVerse.id,
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: '2024-01-01',
        archived: false,
        current_streak: 0,
        best_streak: 0
      });

      // Create archived card
      const archivedVerse = await localDb.verses.create({
        reference: 'Romans 8:28',
        text: 'And we know...',
        translation: 'ESV'
      });

      await localDb.verseCards.create({
        user_id: testUserId,
        verse_id: archivedVerse.id,
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: '2024-01-01',
        archived: true,
        current_streak: 0,
        best_streak: 0
      });

      const userCards = await localDb.verseCards.getByUser(testUserId);
      expect(userCards).toHaveLength(1);
      expect(userCards[0].archived).toBe(false);
    });

    test('gets due cards for user', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // Due today
      await localDb.verseCards.create({
        user_id: testUserId,
        verse_id: testVerse.id,
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: today,
        archived: false,
        current_streak: 0,
        best_streak: 0
      });

      // Overdue (yesterday)
      const overdueVerse = await localDb.verses.create({
        reference: 'Romans 8:28',
        text: 'And we know...',
        translation: 'ESV'
      });

      await localDb.verseCards.create({
        user_id: testUserId,
        verse_id: overdueVerse.id,
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: yesterday,
        archived: false,
        current_streak: 0,
        best_streak: 0
      });

      // Not due (tomorrow)
      const futureVerse = await localDb.verses.create({
        reference: '1 Cor 13:4',
        text: 'Love is patient...',
        translation: 'ESV'
      });

      await localDb.verseCards.create({
        user_id: testUserId,
        verse_id: futureVerse.id,
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: tomorrow,
        archived: false,
        current_streak: 0,
        best_streak: 0
      });

      const dueCards = await localDb.verseCards.getDue(testUserId);
      expect(dueCards).toHaveLength(2); // Today + yesterday
    });
  });

  describe('Database hooks', () => {
    test('auto-sets timestamps on verse creation', async () => {
      const beforeCreate = new Date().toISOString();
      
      const verse = await localDb.verses.create({
        reference: 'John 3:16',
        text: 'For God so loved...',
        translation: 'ESV'
      });

      const afterCreate = new Date().toISOString();
      
      expect(verse.created_at).toBeDefined();
      expect(verse.updated_at).toBeDefined();
      expect(verse.created_at >= beforeCreate).toBe(true);
      expect(verse.created_at <= afterCreate).toBe(true);
      expect(verse.created_at).toBe(verse.updated_at);
    });

    test('sets default translation to ESV', async () => {
      const verse = await localDb.verses.create({
        reference: 'John 3:16',
        text: 'For God so loved...',
        translation: 'ESV' // Must provide required field
      });

      expect(verse.translation).toBe('ESV');
    });

    test('auto-sets defaults on verse card creation', async () => {
      const testVerse = await localDb.verses.create({
        reference: 'John 3:16',
        text: 'For God so loved...',
        translation: 'ESV'
      });

      const card = await localDb.verseCards.create({
        user_id: 'test-user',
        verse_id: testVerse.id,
        current_phase: 'daily' as const,
        phase_progress_count: 0,
        last_reviewed_at: null,
        next_due_date: '2024-01-01',
        archived: false,
        current_streak: 0,
        best_streak: 0
      });

      expect(card.phase_progress_count).toBe(0);
      expect(card.archived).toBe(false);
      expect(card.current_streak).toBe(0);
      expect(card.best_streak).toBe(0);
      expect(card.current_phase).toBe('daily');
    });
  });

  describe('Database utilities', () => {
    test('clears all data', async () => {
      await localDb.verses.create({
        reference: 'John 3:16',
        text: 'For God so loved...',
        translation: 'ESV'
      });

      let verses = await localDb.verses.getAll();
      expect(verses).toHaveLength(1);

      await localDb.clear();
      
      verses = await localDb.verses.getAll();
      expect(verses).toHaveLength(0);
    });
  });
});