export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      aliases: {
        Row: {
          alias: string
          created_at: string | null
          id: string
          verse_id: string
        }
        Insert: {
          alias: string
          created_at?: string | null
          id?: string
          verse_id: string
        }
        Update: {
          alias?: string
          created_at?: string | null
          id?: string
          verse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aliases_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "verses"
            referencedColumns: ["id"]
          },
        ]
      }
      review_logs: {
        Row: {
          counted_toward_progress: boolean
          created_at: string | null
          id: string
          review_time_seconds: number | null
          user_id: string
          verse_card_id: string
          was_successful: boolean
        }
        Insert: {
          counted_toward_progress: boolean
          created_at?: string | null
          id?: string
          review_time_seconds?: number | null
          user_id: string
          verse_card_id: string
          was_successful: boolean
        }
        Update: {
          counted_toward_progress?: boolean
          created_at?: string | null
          id?: string
          review_time_seconds?: number | null
          user_id?: string
          verse_card_id?: string
          was_successful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_verse_card_id_fkey"
            columns: ["verse_card_id"]
            isOneToOne: false
            referencedRelation: "verse_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          preferred_translation: string | null
          reference_display_mode: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          preferred_translation?: string | null
          reference_display_mode?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          preferred_translation?: string | null
          reference_display_mode?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verse_cards: {
        Row: {
          archived: boolean
          assigned_day_of_month: number | null
          assigned_day_of_week: number | null
          assigned_week_parity: number | null
          best_streak: number | null
          created_at: string | null
          current_phase: string
          current_streak: number
          id: string
          last_reviewed_at: string | null
          next_due_date: string
          phase_progress_count: number
          updated_at: string | null
          user_id: string
          verse_id: string
        }
        Insert: {
          archived?: boolean
          assigned_day_of_month?: number | null
          assigned_day_of_week?: number | null
          assigned_week_parity?: number | null
          best_streak?: number | null
          created_at?: string | null
          current_phase?: string
          current_streak?: number
          id?: string
          last_reviewed_at?: string | null
          next_due_date?: string
          phase_progress_count?: number
          updated_at?: string | null
          user_id: string
          verse_id: string
        }
        Update: {
          archived?: boolean
          assigned_day_of_month?: number | null
          assigned_day_of_week?: number | null
          assigned_week_parity?: number | null
          best_streak?: number | null
          created_at?: string | null
          current_phase?: string
          current_streak?: number
          id?: string
          last_reviewed_at?: string | null
          next_due_date?: string
          phase_progress_count?: number
          updated_at?: string | null
          user_id?: string
          verse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verse_cards_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "verses"
            referencedColumns: ["id"]
          },
        ]
      }
      verses: {
        Row: {
          created_at: string | null
          id: string
          reference: string
          text: string
          translation: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reference: string
          text: string
          translation?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reference?: string
          text?: string
          translation?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_assigned_date: {
        Args: {
          phase_name: string
          day_of_week_param: number
          week_parity_param: number
          day_of_month_param: number
          user_timezone: string
        }
        Returns: string
      }
      get_optimal_assignment: {
        Args: { user_id_param: string; target_phase: string }
        Returns: {
          day_of_week: number
          week_parity: number
          day_of_month: number
        }[]
      }
      rpc_create_alias: {
        Args: { p_alias: string; p_verse_id: string }
        Returns: Json
      }
      rpc_create_verse: {
        Args: { p_reference: string; p_text: string; p_translation?: string }
        Returns: Json
      }
      rpc_verse_lookup: {
        Args: {
          p_reference: string
          p_normalized: string
          p_user_id?: string
          p_translation?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
