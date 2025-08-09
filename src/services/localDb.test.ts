import { db } from './localDb';

describe('localDb', () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await db.transaction('rw', [
      db.verses, 
      db.verse_cards, 
      db.review_logs, 
      db.aliases, 
      db.user_profiles,
      db.syncQueue
    ], async () => {
      await Promise.all([
        db.verses.clear(),
        db.verse_cards.clear(),
        db.review_logs.clear(),
        db.aliases.clear(),
        db.user_profiles.clear(),
        db.syncQueue.clear()
      ]);
    });
  });

  afterAll(async () => {
    await db.close();
  });

  test('database opens successfully', async () => {
    expect(db.isOpen()).toBe(true);
  });

  describe('verses table', () => {
    test('can add and retrieve verse', async () => {
      const verse = {
        reference: 'John 3:16',
        text: 'For God so loved the world...',
        translation: 'ESV',
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const id = await db.verses.add(verse);
      const retrieved = await db.verses.get(id);

      expect(retrieved?.reference).toBe('John 3:16');
      expect(retrieved?.is_verified).toBe(true);
    });
  });

  describe('verse_cards table', () => {
    test('can create verse card linked to verse', async () => {
      // First create a verse
      const verseId = await db.verses.add({
        reference: 'John 3:16',
        text: 'For God so loved the world...',
        translation: 'ESV',
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Then create verse card
      const cardId = await db.verse_cards.add({
        user_id: 'user-123',
        verse_id: verseId as string,
        current_phase: 'daily',
        current_streak: 0,
        best_streak: 0,
        phase_progress_count: 0,
        assigned_day_of_week: null,
        assigned_week_parity: null,
        assigned_day_of_month: null,
        last_reviewed_at: null,
        next_due_date: '2024-01-15',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived: false
      });

      const card = await db.verse_cards.get(cardId);
      expect(card?.current_phase).toBe('daily');
      expect(card?.archived).toBe(false);
    });
  });

  describe('user_profiles table', () => {
    test('can create and update user profile', async () => {
      const profile = {
        user_id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        timezone: 'UTC',
        preferred_translation: 'ESV',
        reference_display_mode: 'full',
        pending_email_verification: null,
        email_verification_sent_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const id = await db.user_profiles.add(profile);
      const retrieved = await db.user_profiles.get(id);

      expect(retrieved?.email).toBe('test@example.com');
      expect(retrieved?.timezone).toBe('UTC');
    });
  });

  describe('syncQueue table', () => {
    test('can queue sync operations', async () => {
      const operation = {
        id: 'op-123',
        type: 'create_verse' as const,
        data: { reference: 'John 3:16' },
        localRef: 'local-ref-123',
        userId: 'user-123',
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending' as const
      };

      const id = await db.syncQueue.add(operation);
      const retrieved = await db.syncQueue.get(id);

      expect(retrieved?.type).toBe('create_verse');
      expect(retrieved?.status).toBe('pending');
    });
  });
});