import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Typed Supabase client
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Creates a new Supabase client instance with proper configuration and validation.
 */
export function createSupabaseClient(): TypedSupabaseClient {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      // Configure auth persistence
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    // Disable realtime for better performance - this is a single-user study app
    realtime: {
      params: {
        eventsPerSecond: 0, // Disable realtime subscriptions
      },
    },
  });
}

// Export singleton client instance
export const supabaseClient = createSupabaseClient();

// Helper functions for common database operations
export const db = {
  // User profiles operations
  userProfiles: {
    async get(userId: string) {
      return supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId) // Use user_id, not id
        .single();
    },

    async update(userId: string, updates: Database['public']['Tables']['user_profiles']['Update']) {
      return supabaseClient
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId) // Use user_id, not id
        .select()
        .single();
    },
  },

  // Verses operations (shared cache)
  verses: {
    async getByReference(reference: string, translation: string = 'ESV') {
      return supabaseClient
        .from('verses')
        .select('id, reference, text, translation, created_at, updated_at')
        .eq('reference', reference)
        .eq('translation', translation)
        .maybeSingle();
    },

    async getById(id: string) {
      return supabaseClient
        .from('verses')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    },

    async create(verse: Database['public']['Tables']['verses']['Insert']) {
      return supabaseClient
        .from('verses')
        .insert(verse)
        .select('id, reference, text, translation, created_at, updated_at')
        .single();
    },

    async findOrCreate(reference: string, text: string, translation: string = 'ESV') {
      // First try to find existing verse
      const existing = await this.getByReference(reference, translation);
      if (existing.data) {

        return existing;
      }

      // If not found, create new verse
      // Handle potential race condition where another user creates the same verse
      try {
        return await this.create({ reference, text, translation });
      } catch (error: any) {
        // If unique constraint violation, try to fetch again
        if (error?.code === '23505') {
          return this.getByReference(reference, translation);
        }
        throw error;
      }
    },
  },

  // Verse cards operations
  verseCards: {
    async getAll(userId: string) {
      return supabaseClient
        .from('verse_cards')
        .select(`
          *,
          verses (
            reference,
            text,
            translation
          )
        `)
        .eq('user_id', userId)
        .order('next_due_date', { ascending: true });
    },

    async getDue(userId: string) {
      const today = new Date().toISOString().split('T')[0];
      return supabaseClient
        .from('verse_cards')
        .select(`
          *,
          verses (
            reference,
            text,
            translation
          )
        `)
        .eq('user_id', userId)
        .eq('archived', false)
        .lte('next_due_date', today)
        .order('next_due_date', { ascending: true });
    },

    async getByUserAndVerse(userId: string, verseId: string) {
      return supabaseClient
        .from('verse_cards')
        .select('*')
        .eq('user_id', userId)
        .eq('verse_id', verseId)
        .maybeSingle();
    },

    async create(card: Database['public']['Tables']['verse_cards']['Insert']) {
      return supabaseClient
        .from('verse_cards')
        .insert(card)
        .select()
        .single();
    },

    async findOrCreate(card: Database['public']['Tables']['verse_cards']['Insert']) {
      const existing = await this.getByUserAndVerse(card.user_id, card.verse_id);
      if (existing.data) {
        return {...existing, statusText: "found"};
      }
      return this.create(card);
    },

    async update(id: string, updates: Database['public']['Tables']['verse_cards']['Update'], userId: string) {
      return supabaseClient
        .from('verse_cards')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
    },
  },

  // User verses operations (combines verse cards with verse data)
  userVerses: {
    async getByUserId(userId: string) {
      return supabaseClient
        .from('verse_cards')
        .select(`
          id,
          current_phase,
          next_due_date,
          current_streak,
          verses (
            id,
            reference,
            text,
            translation
          )
        `)
        .eq('user_id', userId)
        .eq('archived', false);
    },

    async create(data: any) {
      // This would involve creating verse cards - simplified for now
      return supabaseClient
        .from('verse_cards')
        .insert(data)
        .select()
        .single();
    },

    async update(cardId: string, updates: any) {
      return supabaseClient
        .from('verse_cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single();
    },

    async delete(cardId: string) {
      return supabaseClient
        .from('verse_cards')
        .delete()
        .eq('id', cardId);
    },
  },

  // Review logs operations
  reviewLogs: {
    async create(log: Database['public']['Tables']['review_logs']['Insert']) {
      return supabaseClient
        .from('review_logs')
        .insert(log)
        .select()
        .single();
    },

    async getStats(userId: string, days: number = 30) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return supabaseClient
        .from('review_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
    },
  },

  // Aliases operations
  aliases: {
    async getByAlias(alias: string) {
      return supabaseClient
        .from('aliases')
        .select('verse_id, verses!inner(*)')
        .eq('alias', alias) 
        .maybeSingle();
    },

    async create(alias: string, verseId: string) {
      return supabaseClient
        .from('aliases')
        .insert({
          alias: alias,
          verse_id: verseId
        })
        .select()
        .single();
    },
  },

  // RPC functions
  rpc: {
    async verseLookup(reference: string, normalizedRef: string, userId?: string) {
      return supabaseClient.rpc('rpc_verse_lookup', {
        p_reference: reference,
        p_normalized: normalizedRef,
        p_user_id: userId || undefined
      });
    },
  },
};
