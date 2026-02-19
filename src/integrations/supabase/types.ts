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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "agent_executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "agent_memories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
        }
        Insert: {
          bot_id: string
          executed_at?: string
          id?: string
          lead_id: string
          message?: string | null
          node_id: string
          status: string
          workspace_id: string
        }
        Update: {
          bot_id?: string
          executed_at?: string
          id?: string
          lead_id?: string
          message?: string | null
          node_id?: string
          status?: string
          workspace_id?: string
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
          {
            foreignKeyName: "bot_execution_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "funnel_stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "lead_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_proposals: {
        Row: {
          created_at: string
          description: string
          id: string
          lead_id: string
          sent_at: string | null
          status: string
          updated_at: string
          valid_until: string | null
          value: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          lead_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
          value?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sales: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          link: string | null
          product_name: string
          sale_date: string
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          link?: string | null
          product_name: string
          sale_date?: string
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          link?: string | null
          product_name?: string
          sale_date?: string
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sales_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          tag_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          tag_id?: string
          workspace_id?: string
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
          {
            foreignKeyName: "lead_tag_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_responsible_user_fkey"
            columns: ["responsible_user"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_access_token: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_access_token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_conversations: {
        Row: {
          content: string | null
          created_at: string
          direction: string
          id: string
          media_url: string | null
          message_id: string | null
          message_type: string
          meta_page_id: string | null
          platform: string
          raw_payload: Json | null
          sender_id: string
          sender_name: string | null
          timestamp: string
          workspace_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          meta_page_id?: string | null
          platform?: string
          raw_payload?: Json | null
          sender_id: string
          sender_name?: string | null
          timestamp?: string
          workspace_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          meta_page_id?: string | null
          platform?: string
          raw_payload?: Json | null
          sender_id?: string
          sender_name?: string | null
          timestamp?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_conversations_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string | null
          id: string
          no_response_minutes: number | null
          notify_no_response: boolean | null
          notify_weekly_report: boolean | null
          updated_at: string | null
          user_id: string
          weekly_report_day: number | null
          weekly_report_hour: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          no_response_minutes?: number | null
          notify_no_response?: boolean | null
          notify_weekly_report?: boolean | null
          updated_at?: string | null
          user_id: string
          weekly_report_day?: number | null
          weekly_report_hour?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          no_response_minutes?: number | null
          notify_no_response?: boolean | null
          notify_weekly_report?: boolean | null
          updated_at?: string | null
          user_id?: string
          weekly_report_day?: number | null
          weekly_report_hour?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salesbots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          channel_type: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          instance_name: string | null
          message: string
          meta_page_id: string | null
          phone_number: string | null
          remote_jid: string | null
          scheduled_at: string
          sender_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel_type: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          instance_name?: string | null
          message: string
          meta_page_id?: string | null
          phone_number?: string | null
          remote_jid?: string | null
          scheduled_at: string
          sender_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel_type?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          instance_name?: string | null
          message?: string
          meta_page_id?: string | null
          phone_number?: string | null
          remote_jid?: string | null
          scheduled_at?: string
          sender_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          match_phrase: string
          tag_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_phrase: string
          tag_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_phrase?: string
          tag_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      user_sessions: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_label: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_seen_at: string
          region: string | null
          user_agent: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_seen_at?: string
          region?: string | null
          user_agent?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_seen_at?: string
          region?: string | null
          user_agent?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_name: string | null
          id: string
          instance_name: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          id?: string
          instance_name: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          id?: string
          instance_name?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          invited_email: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      meta_conversation_summary: {
        Row: {
          content: string | null
          direction: string | null
          message_type: string | null
          meta_page_id: string | null
          platform: string | null
          sender_id: string | null
          sender_name: string | null
          timestamp: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_conversations_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_user_workspace_id: { Args: { _user_id: string }; Returns: string }
      get_user_workspace_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_agent_executions: {
        Args: { agent_id_param: string }
        Returns: undefined
      }
      is_any_workspace_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "seller"
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
      app_role: ["admin", "manager", "seller"],
      lead_status: ["active", "won", "lost", "archived"],
      meta_platform: ["facebook", "instagram", "both"],
    },
  },
} as const
