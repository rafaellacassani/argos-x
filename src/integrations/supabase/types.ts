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
      agent_executions: {
        Row: {
          agent_id: string
          error_message: string | null
          executed_at: string
          id: string
          input_message: string
          latency_ms: number | null
          lead_id: string | null
          output_message: string | null
          session_id: string
          status: string
          tokens_used: number | null
          tools_used: Json | null
        }
        Insert: {
          agent_id: string
          error_message?: string | null
          executed_at?: string
          id?: string
          input_message: string
          latency_ms?: number | null
          lead_id?: string | null
          output_message?: string | null
          session_id: string
          status?: string
          tokens_used?: number | null
          tools_used?: Json | null
        }
        Update: {
          agent_id?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          input_message?: string
          latency_ms?: number | null
          lead_id?: string | null
          output_message?: string | null
          session_id?: string
          status?: string
          tokens_used?: number | null
          tools_used?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_executions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          agent_id: string
          context_window: number | null
          created_at: string
          id: string
          is_paused: boolean | null
          lead_id: string | null
          messages: Json
          session_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          context_window?: number | null
          created_at?: string
          id?: string
          is_paused?: boolean | null
          lead_id?: string | null
          messages?: Json
          session_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          context_window?: number | null
          created_at?: string
          id?: string
          is_paused?: boolean | null
          lead_id?: string | null
          messages?: Json
          session_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memories_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          created_at: string
          description: string | null
          fallback_config: Json | null
          id: string
          is_active: boolean | null
          max_tokens: number | null
          message_split_enabled: boolean | null
          message_split_length: number | null
          model: string
          name: string
          pause_code: string | null
          resume_keyword: string | null
          system_prompt: string
          temperature: number | null
          tools: Json | null
          trigger_config: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fallback_config?: Json | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          message_split_enabled?: boolean | null
          message_split_length?: number | null
          model?: string
          name: string
          pause_code?: string | null
          resume_keyword?: string | null
          system_prompt: string
          temperature?: number | null
          tools?: Json | null
          trigger_config?: Json | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fallback_config?: Json | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          message_split_enabled?: boolean | null
          message_split_length?: number | null
          model?: string
          name?: string
          pause_code?: string | null
          resume_keyword?: string | null
          system_prompt?: string
          temperature?: number | null
          tools?: Json | null
          trigger_config?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_execution_logs: {
        Row: {
          bot_id: string
          executed_at: string
          id: string
          lead_id: string
          message: string | null
          node_id: string
          status: string
        }
        Insert: {
          bot_id: string
          executed_at?: string
          id?: string
          lead_id: string
          message?: string | null
          node_id: string
          status: string
        }
        Update: {
          bot_id?: string
          executed_at?: string
          id?: string
          lead_id?: string
          message?: string | null
          node_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_execution_logs_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "salesbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_execution_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          bot_id: string | null
          color: string
          created_at: string
          funnel_id: string
          id: string
          is_loss_stage: boolean | null
          is_win_stage: boolean | null
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          bot_id?: string | null
          color?: string
          created_at?: string
          funnel_id: string
          id?: string
          is_loss_stage?: boolean | null
          is_win_stage?: boolean | null
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          bot_id?: string | null
          color?: string
          created_at?: string
          funnel_id?: string
          id?: string
          is_loss_stage?: boolean | null
          is_win_stage?: boolean | null
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "salesbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_history: {
        Row: {
          action: string
          created_at: string
          from_stage_id: string | null
          id: string
          lead_id: string
          metadata: Json | null
          performed_by: string | null
          to_stage_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_stage_id?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          performed_by?: string | null
          to_stage_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_stage_id?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          performed_by?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tag_assignments: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tag_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          instance_name: string | null
          name: string
          notes: string | null
          phone: string
          position: number
          responsible_user: string | null
          source: string | null
          stage_id: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          value: number | null
          whatsapp_jid: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instance_name?: string | null
          name: string
          notes?: string | null
          phone: string
          position?: number
          responsible_user?: string | null
          source?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number | null
          whatsapp_jid?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instance_name?: string | null
          name?: string
          notes?: string | null
          phone?: string
          position?: number
          responsible_user?: string | null
          source?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number | null
          whatsapp_jid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_accounts: {
        Row: {
          created_at: string
          id: string
          token_expires_at: string | null
          updated_at: string
          user_access_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_access_token: string
        }
        Update: {
          created_at?: string
          id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_access_token?: string
        }
        Relationships: []
      }
      meta_pages: {
        Row: {
          created_at: string
          id: string
          instagram_account_id: string | null
          instagram_username: string | null
          is_active: boolean
          meta_account_id: string
          page_access_token: string
          page_id: string
          page_name: string
          platform: Database["public"]["Enums"]["meta_platform"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          instagram_username?: string | null
          is_active?: boolean
          meta_account_id: string
          page_access_token: string
          page_id: string
          page_name: string
          platform?: Database["public"]["Enums"]["meta_platform"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          instagram_username?: string | null
          is_active?: boolean
          meta_account_id?: string
          page_access_token?: string
          page_id?: string
          page_name?: string
          platform?: Database["public"]["Enums"]["meta_platform"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      salesbots: {
        Row: {
          conversions_count: number
          created_at: string
          description: string | null
          executions_count: number
          flow_data: Json | null
          id: string
          is_active: boolean
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          conversions_count?: number
          created_at?: string
          description?: string | null
          executions_count?: number
          flow_data?: Json | null
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          conversions_count?: number
          created_at?: string
          description?: string | null
          executions_count?: number
          flow_data?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tag_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          match_phrase: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_phrase: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_phrase?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          instance_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          instance_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          instance_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_agent_executions: {
        Args: { agent_id_param: string }
        Returns: undefined
      }
    }
    Enums: {
      lead_status: "active" | "won" | "lost" | "archived"
      meta_platform: "facebook" | "instagram" | "both"
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
      lead_status: ["active", "won", "lost", "archived"],
      meta_platform: ["facebook", "instagram", "both"],
    },
  },
} as const
