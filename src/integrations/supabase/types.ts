export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string
          rarity: Database["public"]["Enums"]["card_rarity"]
          release_date: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          image_url: string
          rarity?: Database["public"]["Enums"]["card_rarity"]
          release_date?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          rarity?: Database["public"]["Enums"]["card_rarity"]
          release_date?: string
          title?: string
        }
        Relationships: []
      }
      code_redemptions: {
        Row: {
          boost_expires_at: string | null
          code_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          boost_expires_at?: string | null
          code_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          boost_expires_at?: string | null
          code_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "reward_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_rates: {
        Row: {
          created_at: string
          id: string
          rarity: string
          rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          rarity: string
          rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          rarity?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          event_id: string | null
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          event_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          event_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_timeline_segments: {
        Row: {
          config: Json | null
          created_at: string | null
          duration_seconds: number
          event_id: string
          id: string
          segment_type: string
          start_offset_seconds: number
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          duration_seconds: number
          event_id: string
          id?: string
          segment_type: string
          start_offset_seconds?: number
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          duration_seconds?: number
          event_id?: string
          id?: string
          segment_type?: string
          start_offset_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_timeline_segments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          affects_free_pack: boolean | null
          affects_lucky_pack: boolean | null
          affects_standard_pack: boolean | null
          affects_ultra_pack: boolean | null
          bonus_cards: number | null
          confetti_enabled: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          end_at: string
          flash_enabled: boolean | null
          global_multiplier: number | null
          glow_enabled: boolean | null
          id: string
          is_active: boolean
          is_draft: boolean
          max_stack: number | null
          music_url: string | null
          name: string
          rarity_boosts: Json | null
          sound_effect_url: string | null
          special_animation: string | null
          start_at: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string | null
        }
        Insert: {
          affects_free_pack?: boolean | null
          affects_lucky_pack?: boolean | null
          affects_standard_pack?: boolean | null
          affects_ultra_pack?: boolean | null
          bonus_cards?: number | null
          confetti_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_at: string
          flash_enabled?: boolean | null
          global_multiplier?: number | null
          glow_enabled?: boolean | null
          id?: string
          is_active?: boolean
          is_draft?: boolean
          max_stack?: number | null
          music_url?: string | null
          name: string
          rarity_boosts?: Json | null
          sound_effect_url?: string | null
          special_animation?: string | null
          start_at: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string | null
        }
        Update: {
          affects_free_pack?: boolean | null
          affects_lucky_pack?: boolean | null
          affects_standard_pack?: boolean | null
          affects_ultra_pack?: boolean | null
          bonus_cards?: number | null
          confetti_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_at?: string
          flash_enabled?: boolean | null
          global_multiplier?: number | null
          glow_enabled?: boolean | null
          id?: string
          is_active?: boolean
          is_draft?: boolean
          max_stack?: number | null
          music_url?: string | null
          name?: string
          rarity_boosts?: Json | null
          sound_effect_url?: string | null
          special_animation?: string | null
          start_at?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      global_gifs: {
        Row: {
          created_at: string
          created_by: string | null
          height: number
          id: string
          url: string
          visible: boolean
          width: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          height?: number
          id?: string
          url: string
          visible?: boolean
          width?: number
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          height?: number
          id?: string
          url?: string
          visible?: boolean
          width?: number
          x?: number
          y?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          language: string | null
          notifications_enabled: boolean | null
          theme: string | null
          username: string | null
          visual_effects_enabled: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          language?: string | null
          notifications_enabled?: boolean | null
          theme?: string | null
          username?: string | null
          visual_effects_enabled?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          theme?: string | null
          username?: string | null
          visual_effects_enabled?: boolean | null
        }
        Relationships: []
      }
      purchase_transactions: {
        Row: {
          card_count: number
          id: string
          pack_type: string | null
          processed_at: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          card_count: number
          id?: string
          pack_type?: string | null
          processed_at?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          card_count?: number
          id?: string
          pack_type?: string | null
          processed_at?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          reward_config: Json
          reward_type: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          reward_config?: Json
          reward_type: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          reward_config?: Json
          reward_type?: string
        }
        Relationships: []
      }
      user_cards: {
        Row: {
          card_id: string
          id: string
          obtained_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          id?: string
          obtained_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          id?: string
          obtained_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          current_streak: number
          id: string
          last_streak_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_streak_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_streak_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      winstreak_claims: {
        Row: {
          claimed_at: string
          day_number: number
          id: string
          reward_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          day_number: number
          id?: string
          reward_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          day_number?: number
          id?: string
          reward_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "winstreak_claims_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "winstreak_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      winstreak_rewards: {
        Row: {
          created_at: string
          created_by: string | null
          day_number: number
          id: string
          reward_config: Json
          reward_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_number: number
          id?: string
          reward_config?: Json
          reward_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_number?: number
          id?: string
          reward_config?: Json
          reward_type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      card_rarity: "common" | "rare" | "epic" | "legendary"
      event_type: "short" | "long"
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      card_rarity: ["common", "rare", "epic", "legendary"],
      event_type: ["short", "long"],
    },
  },
} as const
