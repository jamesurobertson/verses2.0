import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database type definitions (will be generated from Supabase later)
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          preferred_translation: string;
          reference_display_mode: 'full' | 'first' | 'blank';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          preferred_translation?: string;
          reference_display_mode?: 'full' | 'first' | 'blank';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          preferred_translation?: string;
          reference_display_mode?: 'full' | 'first' | 'blank';
          created_at?: string;
          updated_at?: string;
        };
      };
      verses: {
        Row: {
          id: string;
          reference: string;
          text: string;
          translation: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference: string;
          text: string;
          translation?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference?: string;
          text?: string;
          translation?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      verse_cards: {
        Row: {
          id: string;
          user_id: string;
          verse_id: string;
          current_phase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
          phase_progress_count: number;
          last_reviewed_at: string | null;
          next_due_date: string;
          archived: boolean;
          current_streak: number;
          best_streak: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          verse_id: string;
          current_phase?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
          phase_progress_count?: number;
          last_reviewed_at?: string | null;
          next_due_date: string;
          archived?: boolean;
          current_streak?: number;
          best_streak?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          verse_id?: string;
          current_phase?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
          phase_progress_count?: number;
          last_reviewed_at?: string | null;
          next_due_date?: string;
          archived?: boolean;
          current_streak?: number;
          best_streak?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      review_logs: {
        Row: {
          id: string;
          user_id: string;
          verse_card_id: string;
          was_successful: boolean;
          counted_toward_progress: boolean;
          review_time_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          verse_card_id: string;
          was_successful: boolean;
          counted_toward_progress: boolean;
          review_time_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          verse_card_id?: string;
          was_successful?: boolean;
          counted_toward_progress?: boolean;
          review_time_seconds?: number | null;
          created_at?: string;
        };
      };
    };
  };
}

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
    // Configure realtime (can be disabled for better performance if not needed)
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

// Export singleton client instance
export const supabaseClient = createSupabaseClient();
// Helper types for common operations
export type UserProfile = {
  id: string;
  email: string;
  created_at: string;
};

export type AuthResponse = {
  user: UserProfile | null;
  error: Error | null;
};

// Helper functions for common database operations
export const db = {
  // User profiles operations
  userProfiles: {
    async get(userId: string) {
      return supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
    },

    async update(userId: string, updates: Database['public']['Tables']['user_profiles']['Update']) {
      return supabaseClient
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    },
  },

  // Verses operations (shared cache)
  verses: {
    async getByReference(reference: string, translation: string = 'ESV') {
      console.log('Supabase getByReference:', { reference, translation });

      // Check auth status
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      console.log('Auth session:', {
        hasSession: !!session,
        sessionError,
        userId: session?.user?.id
      });

      const result = await supabaseClient
        .from('verses')
        .select('*')
        .eq('reference', reference)
        .eq('translation', translation)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 results gracefully
      console.log('Supabase getByReference result:', result);
      return result;
    },

    async getById(id: string) {
      return supabaseClient
        .from('verses')
        .select('*')
        .eq('id', id)
        .single();
    },

    async create(verse: Database['public']['Tables']['verses']['Insert']) {
      console.log('Supabase create verse:', verse);

      // Check auth status
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      console.log('Auth session for create:', {
        hasSession: !!session,
        sessionError,
        userId: session?.user?.id
      });

      const result = await supabaseClient
        .from('verses')
        .insert(verse)
        .select()
        .single();
      console.log('Supabase create verse result:', result);
      return result;
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

    async create(card: Database['public']['Tables']['verse_cards']['Insert']) {
      console.log('Supabase create verse card:', card);

      // Check auth status
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      console.log('Auth session for card create:', {
        hasSession: !!session,
        sessionError,
        userId: session?.user?.id
      });

      const result = await supabaseClient
        .from('verse_cards')
        .insert(card)
        .select()
        .single();
      console.log('Supabase create verse card result:', result);
      if (result.error) {
        console.error('Verse card creation error details:', {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint
        });
      }
      return result;
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
};

// Row Level Security (RLS) helper functions
export const rls = {
  /**
   * Enables RLS on a table (requires admin privileges).
   * This would typically be run in a migration script.
   */
  async enableRLS(tableName: string) {
    return supabaseClient.rpc('enable_rls', { table_name: tableName });
  },

  /**
   * Creates RLS policies for user data isolation.
   * This would typically be run in a migration script.
   */
  async createUserPolicies(tableName: string) {
    // This is a placeholder - actual RLS policies are created via SQL migrations
    console.warn(`RLS policies for ${tableName} should be created via SQL migrations`);
  },
};
