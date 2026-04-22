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
      agent_attachments: {
        Row: {
          agent_id: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          mime_type: string | null
          workspace_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          mime_type?: string | null
          workspace_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_attachments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
      agent_followup_queue: {
        Row: {
          agent_id: string
          canceled_reason: string | null
          created_at: string
          execute_at: string
          executed_at: string | null
          id: string
          lead_id: string
          session_id: string
          status: string
          step_index: number
          workspace_id: string
        }
        Insert: {
          agent_id: string
          canceled_reason?: string | null
          created_at?: string
          execute_at: string
          executed_at?: string | null
          id?: string
          lead_id: string
          session_id: string
          status?: string
          step_index?: number
          workspace_id: string
        }
        Update: {
          agent_id?: string
          canceled_reason?: string | null
          created_at?: string
          execute_at?: string
          executed_at?: string | null
          id?: string
          lead_id?: string
          session_id?: string
          status?: string
          step_index?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_followup_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_followup_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_followup_queue_workspace_id_fkey"
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
          is_processing: boolean | null
          last_message_id: string | null
          last_transfer_at: string | null
          lead_id: string | null
          messages: Json
          processing_started_at: string | null
          session_id: string
          summary: string | null
          transfer_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          context_window?: number | null
          created_at?: string
          id?: string
          is_paused?: boolean | null
          is_processing?: boolean | null
          last_message_id?: string | null
          last_transfer_at?: string | null
          lead_id?: string | null
          messages?: Json
          processing_started_at?: string | null
          session_id: string
          summary?: string | null
          transfer_count?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          context_window?: number | null
          created_at?: string
          id?: string
          is_paused?: boolean | null
          is_processing?: boolean | null
          last_message_id?: string | null
          last_transfer_at?: string | null
          lead_id?: string | null
          messages?: Json
          processing_started_at?: string | null
          session_id?: string
          summary?: string | null
          transfer_count?: number
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
          agent_role: string | null
          calendar_config: Json | null
          cloud_24h_window_only: boolean | null
          company_info: Json | null
          created_at: string
          department_id: string | null
          description: string | null
          fallback_config: Json | null
          followup_enabled: boolean | null
          followup_end_stage_id: string | null
          followup_sequence: Json | null
          id: string
          instance_name: string | null
          is_active: boolean | null
          knowledge_extra: string | null
          knowledge_faq: Json | null
          knowledge_products: string | null
          knowledge_rules: string | null
          main_objective: string | null
          max_tokens: number | null
          max_unproductive_messages: number | null
          media_handoff_enabled: boolean | null
          message_split_enabled: boolean | null
          message_split_length: number | null
          model: string
          name: string
          niche: string | null
          on_start_actions: Json | null
          pause_code: string | null
          qualification_enabled: boolean | null
          qualification_fields: Json | null
          respond_to: string | null
          respond_to_stages: Json | null
          response_delay_seconds: number | null
          response_length: string | null
          resume_keyword: string | null
          style_analysis: string | null
          system_prompt: string
          temperature: number | null
          tone_of_voice: string | null
          tools: Json | null
          trainer_phone: string | null
          trigger_config: Json | null
          type: string
          updated_at: string
          use_emojis: boolean | null
          website_content: string | null
          website_scraped_at: string | null
          website_url: string | null
          workspace_id: string
        }
        Insert: {
          agent_role?: string | null
          calendar_config?: Json | null
          cloud_24h_window_only?: boolean | null
          company_info?: Json | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          fallback_config?: Json | null
          followup_enabled?: boolean | null
          followup_end_stage_id?: string | null
          followup_sequence?: Json | null
          id?: string
          instance_name?: string | null
          is_active?: boolean | null
          knowledge_extra?: string | null
          knowledge_faq?: Json | null
          knowledge_products?: string | null
          knowledge_rules?: string | null
          main_objective?: string | null
          max_tokens?: number | null
          max_unproductive_messages?: number | null
          media_handoff_enabled?: boolean | null
          message_split_enabled?: boolean | null
          message_split_length?: number | null
          model?: string
          name: string
          niche?: string | null
          on_start_actions?: Json | null
          pause_code?: string | null
          qualification_enabled?: boolean | null
          qualification_fields?: Json | null
          respond_to?: string | null
          respond_to_stages?: Json | null
          response_delay_seconds?: number | null
          response_length?: string | null
          resume_keyword?: string | null
          style_analysis?: string | null
          system_prompt: string
          temperature?: number | null
          tone_of_voice?: string | null
          tools?: Json | null
          trainer_phone?: string | null
          trigger_config?: Json | null
          type?: string
          updated_at?: string
          use_emojis?: boolean | null
          website_content?: string | null
          website_scraped_at?: string | null
          website_url?: string | null
          workspace_id: string
        }
        Update: {
          agent_role?: string | null
          calendar_config?: Json | null
          cloud_24h_window_only?: boolean | null
          company_info?: Json | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          fallback_config?: Json | null
          followup_enabled?: boolean | null
          followup_end_stage_id?: string | null
          followup_sequence?: Json | null
          id?: string
          instance_name?: string | null
          is_active?: boolean | null
          knowledge_extra?: string | null
          knowledge_faq?: Json | null
          knowledge_products?: string | null
          knowledge_rules?: string | null
          main_objective?: string | null
          max_tokens?: number | null
          max_unproductive_messages?: number | null
          media_handoff_enabled?: boolean | null
          message_split_enabled?: boolean | null
          message_split_length?: number | null
          model?: string
          name?: string
          niche?: string | null
          on_start_actions?: Json | null
          pause_code?: string | null
          qualification_enabled?: boolean | null
          qualification_fields?: Json | null
          respond_to?: string | null
          respond_to_stages?: Json | null
          response_delay_seconds?: number | null
          response_length?: string | null
          resume_keyword?: string | null
          style_analysis?: string | null
          system_prompt?: string
          temperature?: number | null
          tone_of_voice?: string | null
          tools?: Json | null
          trainer_phone?: string | null
          trigger_config?: Json | null
          type?: string
          updated_at?: string
          use_emojis?: boolean | null
          website_content?: string | null
          website_scraped_at?: string | null
          website_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ai_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_departments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_reception: boolean
          name: string
          position: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_reception?: boolean
          name: string
          position?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_reception?: boolean
          name?: string
          position?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_departments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_log: {
        Row: {
          alert_type: string
          id: string
          lead_id: string | null
          message_preview: string | null
          sent_at: string
          user_profile_id: string
          workspace_id: string
        }
        Insert: {
          alert_type: string
          id?: string
          lead_id?: string | null
          message_preview?: string | null
          sent_at?: string
          user_profile_id: string
          workspace_id: string
        }
        Update: {
          alert_type?: string
          id?: string
          lead_id?: string | null
          message_preview?: string | null
          sent_at?: string
          user_profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_log_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_usage_log: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          id: string
          idempotency_key: string | null
          ip_address: string | null
          latency_ms: number | null
          method: string
          payload_size: number | null
          rate_limited: boolean
          status_code: number
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          latency_ms?: number | null
          method: string
          payload_size?: number | null
          rate_limited?: boolean
          status_code: number
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          latency_ms?: number | null
          method?: string
          payload_size?: number | null
          rate_limited?: boolean
          status_code?: number
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_key_usage_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          allowed_agent_ids: Json | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: Json
          rate_limit_executions_per_hour: number
          rate_limit_messages_per_min: number
          rate_limit_per_hour: number
          revoked_at: string | null
          scopes: string[]
          workspace_id: string
        }
        Insert: {
          allowed_agent_ids?: Json | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: Json
          rate_limit_executions_per_hour?: number
          rate_limit_messages_per_min?: number
          rate_limit_per_hour?: number
          revoked_at?: string | null
          scopes?: string[]
          workspace_id: string
        }
        Update: {
          allowed_agent_ids?: Json | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json
          rate_limit_executions_per_hour?: number
          rate_limit_messages_per_min?: number
          rate_limit_per_hour?: number
          revoked_at?: string | null
          scopes?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
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
      cadence_messages: {
        Row: {
          audio_url: string | null
          cadence_day: number
          channel: string
          config_id: string
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean
          message_type: string
          position: number
          subject: string | null
        }
        Insert: {
          audio_url?: string | null
          cadence_day: number
          channel?: string
          config_id: string
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          message_type?: string
          position?: number
          subject?: string | null
        }
        Update: {
          audio_url?: string | null
          cadence_day?: number
          channel?: string
          config_id?: string
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          message_type?: string
          position?: number
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadence_messages_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "reactivation_cadence_config"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          description: string | null
          end_at: string
          google_event_id: string | null
          id: string
          last_synced_at: string | null
          lead_id: string | null
          location: string | null
          meet_link: string | null
          start_at: string
          synced_to_google: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          end_at: string
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          lead_id?: string | null
          location?: string | null
          meet_link?: string | null
          start_at: string
          synced_to_google?: boolean
          title: string
          type?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          end_at?: string
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          lead_id?: string | null
          location?: string | null
          meet_link?: string | null
          start_at?: string
          synced_to_google?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendly_allowed_workspaces: {
        Row: {
          enabled_at: string
          enabled_by: string | null
          workspace_id: string
        }
        Insert: {
          enabled_at?: string
          enabled_by?: string | null
          workspace_id: string
        }
        Update: {
          enabled_at?: string
          enabled_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendly_allowed_workspaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendly_connections: {
        Row: {
          api_token: string
          calendly_email: string | null
          calendly_user_uri: string | null
          created_at: string
          default_event_type_uri: string | null
          id: string
          scheduling_url: string | null
          sync_enabled: boolean
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          api_token: string
          calendly_email?: string | null
          calendly_user_uri?: string | null
          created_at?: string
          default_event_type_uri?: string | null
          id?: string
          scheduling_url?: string | null
          sync_enabled?: boolean
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          api_token?: string
          calendly_email?: string | null
          calendly_user_uri?: string | null
          created_at?: string
          default_event_type_uri?: string | null
          id?: string
          scheduling_url?: string | null
          sync_enabled?: boolean
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendly_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          error_message: string | null
          id: string
          lead_id: string | null
          personalized_message: string | null
          phone: string
          position: number
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          personalized_message?: string | null
          phone: string
          position?: number
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          personalized_message?: string | null
          phone?: string
          position?: number
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          created_by: string | null
          delivered_count: number | null
          failed_count: number | null
          filter_responsible_ids: Json | null
          filter_stage_ids: Json | null
          filter_tag_ids: Json | null
          id: string
          include_all_contacts: boolean
          instance_name: string
          instance_names: Json | null
          interval_seconds: number
          last_instance_index: number | null
          last_sent_at: string | null
          message_text: string
          name: string
          schedule_days: Json | null
          schedule_end_time: string | null
          schedule_start_time: string | null
          scheduled_at: string | null
          sent_count: number | null
          status: string
          template_id: string | null
          template_variables: Json | null
          total_recipients: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          filter_responsible_ids?: Json | null
          filter_stage_ids?: Json | null
          filter_tag_ids?: Json | null
          id?: string
          include_all_contacts?: boolean
          instance_name: string
          instance_names?: Json | null
          interval_seconds?: number
          last_instance_index?: number | null
          last_sent_at?: string | null
          message_text: string
          name: string
          schedule_days?: Json | null
          schedule_end_time?: string | null
          schedule_start_time?: string | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          template_id?: string | null
          template_variables?: Json | null
          total_recipients?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          filter_responsible_ids?: Json | null
          filter_stage_ids?: Json | null
          filter_tag_ids?: Json | null
          id?: string
          include_all_contacts?: boolean
          instance_name?: string
          instance_names?: Json | null
          interval_seconds?: number
          last_instance_index?: number | null
          last_sent_at?: string | null
          message_text?: string
          name?: string
          schedule_days?: Json | null
          schedule_end_time?: string | null
          schedule_start_time?: string | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          template_id?: string | null
          template_variables?: Json | null
          total_recipients?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_survey_responses: {
        Row: {
          created_at: string
          id: string
          phone: string
          raw_message: string | null
          response_number: number
          response_text: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          raw_message?: string | null
          response_number: number
          response_text: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          raw_message?: string | null
          response_number?: number
          response_text?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "churn_survey_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invites: {
        Row: {
          checkout_url: string | null
          created_at: string
          created_by: string
          email: string
          full_name: string
          id: string
          invite_type: string
          phone: string | null
          plan: string
          status: string
          stripe_customer_id: string | null
          terms_accepted_at: string | null
          terms_accepted_ip: string | null
          terms_accepted_user_agent: string | null
          terms_version: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          checkout_url?: string | null
          created_at?: string
          created_by: string
          email: string
          full_name: string
          id?: string
          invite_type?: string
          phone?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          terms_accepted_at?: string | null
          terms_accepted_ip?: string | null
          terms_accepted_user_agent?: string | null
          terms_version?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          checkout_url?: string | null
          created_at?: string
          created_by?: string
          email?: string
          full_name?: string
          id?: string
          invite_type?: string
          phone?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          terms_accepted_at?: string | null
          terms_accepted_ip?: string | null
          terms_accepted_user_agent?: string | null
          terms_version?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          bairro: string | null
          bdr: string | null
          cep: string | null
          closer: string | null
          cnpj: string | null
          created_at: string | null
          created_by: string | null
          data_inicio_pagamento: string | null
          endereco: string | null
          estado: string | null
          financeiro_email: string | null
          id: string
          municipio: string | null
          negociacoes_personalizadas: string | null
          nome_fantasia: string | null
          numero: string | null
          pacote: string
          pais: string | null
          razao_social: string
          socio_cpf: string | null
          socio_email: string | null
          socio_nome: string
          socio_telefone: string | null
          stage: string
          stakeholder_email: string | null
          stakeholder_nome: string | null
          status: string
          updated_at: string | null
          valor_extenso: string | null
          valor_negociado: number
          workspace_id: string
        }
        Insert: {
          bairro?: string | null
          bdr?: string | null
          cep?: string | null
          closer?: string | null
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          data_inicio_pagamento?: string | null
          endereco?: string | null
          estado?: string | null
          financeiro_email?: string | null
          id?: string
          municipio?: string | null
          negociacoes_personalizadas?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          pacote?: string
          pais?: string | null
          razao_social: string
          socio_cpf?: string | null
          socio_email?: string | null
          socio_nome: string
          socio_telefone?: string | null
          stage?: string
          stakeholder_email?: string | null
          stakeholder_nome?: string | null
          status?: string
          updated_at?: string | null
          valor_extenso?: string | null
          valor_negociado?: number
          workspace_id: string
        }
        Update: {
          bairro?: string | null
          bdr?: string | null
          cep?: string | null
          closer?: string | null
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          data_inicio_pagamento?: string | null
          endereco?: string | null
          estado?: string | null
          financeiro_email?: string | null
          id?: string
          municipio?: string | null
          negociacoes_personalizadas?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          pacote?: string
          pais?: string | null
          razao_social?: string
          socio_cpf?: string | null
          socio_email?: string | null
          socio_nome?: string
          socio_telefone?: string | null
          stage?: string
          stakeholder_email?: string | null
          stakeholder_nome?: string | null
          status?: string
          updated_at?: string | null
          valor_extenso?: string | null
          valor_negociado?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_audit_log: {
        Row: {
          connection_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          performed_by: string | null
          workspace_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          performed_by?: string | null
          workspace_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          performed_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_audit_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_cloud_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      department_transfers: {
        Row: {
          created_at: string
          from_agent_id: string | null
          from_department_id: string | null
          id: string
          lead_id: string | null
          reason: string | null
          to_agent_id: string | null
          to_department_id: string | null
          triggered_by: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          from_agent_id?: string | null
          from_department_id?: string | null
          id?: string
          lead_id?: string | null
          reason?: string | null
          to_agent_id?: string | null
          to_department_id?: string | null
          triggered_by?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          from_agent_id?: string | null
          from_department_id?: string | null
          id?: string
          lead_id?: string | null
          reason?: string | null
          to_agent_id?: string | null
          to_department_id?: string | null
          triggered_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_transfers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_transfers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string
          created_at: string
          email_address: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          provider: string
          refresh_token: string
          sync_cursor: string | null
          token_expiry: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email_address: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider?: string
          refresh_token: string
          sync_cursor?: string | null
          token_expiry: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email_address?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string
          sync_cursor?: string | null
          token_expiry?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          cc_emails: Json | null
          created_at: string
          email_account_id: string
          folder: string
          from_email: string | null
          from_name: string | null
          has_attachments: boolean
          id: string
          is_read: boolean
          is_starred: boolean
          provider_id: string
          received_at: string
          snippet: string | null
          subject: string | null
          thread_id: string | null
          to_emails: Json | null
          workspace_id: string
        }
        Insert: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string
          email_account_id: string
          folder?: string
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          is_read?: boolean
          is_starred?: boolean
          provider_id: string
          received_at?: string
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          to_emails?: Json | null
          workspace_id: string
        }
        Update: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string
          email_account_id?: string
          folder?: string
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          is_read?: boolean
          is_starred?: boolean
          provider_id?: string
          received_at?: string
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          to_emails?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_campaign_contacts: {
        Row: {
          campaign_id: string
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          last_message_preview: string | null
          message_sent: string | null
          sender_id: string | null
          sent_at: string | null
          skip_reason: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          last_message_preview?: string | null
          message_sent?: string | null
          sender_id?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          last_message_preview?: string | null
          message_sent?: string | null
          sender_id?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "followup_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_campaign_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_campaigns: {
        Row: {
          agent_id: string
          context_prompt: string
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          instance_name: string | null
          instance_type: string
          meta_page_id: string | null
          sent_count: number
          skipped_count: number
          status: string
          total_contacts: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          context_prompt: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          instance_name?: string | null
          instance_type?: string
          meta_page_id?: string | null
          sent_count?: number
          skipped_count?: number
          status?: string
          total_contacts?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          context_prompt?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          instance_name?: string | null
          instance_type?: string
          meta_page_id?: string | null
          sent_count?: number
          skipped_count?: number
          status?: string
          total_contacts?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_campaigns_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_campaigns_workspace_id_fkey"
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
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          google_calendar_id: string | null
          google_email: string | null
          id: string
          refresh_token: string
          sync_enabled: boolean
          token_expiry: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          google_calendar_id?: string | null
          google_email?: string | null
          id?: string
          refresh_token: string
          sync_enabled?: boolean
          token_expiry: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          google_calendar_id?: string | null
          google_email?: string | null
          id?: string
          refresh_token?: string
          sync_enabled?: boolean
          token_expiry?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      human_support_queue: {
        Row: {
          agent_id: string | null
          assigned_to: string | null
          created_at: string
          id: string
          instance_name: string | null
          lead_id: string | null
          notes: string | null
          reason: string
          resolved_at: string | null
          session_id: string | null
          status: string
          ticket_id: string | null
          ticket_number: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          notes?: string | null
          reason?: string
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          ticket_id?: string | null
          ticket_number?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          notes?: string | null
          reason?: string
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          ticket_id?: string | null
          ticket_number?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "human_support_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_support_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_support_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      human_support_queue_backup_20260416: {
        Row: {
          agent_id: string | null
          assigned_to: string | null
          created_at: string | null
          id: string | null
          instance_name: string | null
          lead_id: string | null
          notes: string | null
          reason: string | null
          resolved_at: string | null
          session_id: string | null
          status: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: string | null
          instance_name?: string | null
          lead_id?: string | null
          notes?: string | null
          reason?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: string | null
          instance_name?: string | null
          lead_id?: string | null
          notes?: string | null
          reason?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_attribution: {
        Row: {
          created_at: string
          fbclid: string | null
          id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          fbclid?: string | null
          id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          fbclid?: string | null
          id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      lead_custom_field_definitions: {
        Row: {
          created_at: string | null
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_active: boolean | null
          options: Json | null
          position: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          options?: Json | null
          position?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          options?: Json | null
          position?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_field_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_custom_field_values: {
        Row: {
          created_at: string | null
          field_definition_id: string
          id: string
          lead_id: string
          updated_at: string | null
          value: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          field_definition_id: string
          id?: string
          lead_id: string
          updated_at?: string | null
          value?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          field_definition_id?: string
          id?: string
          lead_id?: string
          updated_at?: string | null
          value?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "lead_custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_field_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_field_values_workspace_id_fkey"
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
      lead_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_packs: {
        Row: {
          active: boolean | null
          asaas_subscription_id: string | null
          created_at: string | null
          id: string
          pack_size: number
          price_paid: number | null
          stripe_item_id: string | null
          workspace_id: string
        }
        Insert: {
          active?: boolean | null
          asaas_subscription_id?: string | null
          created_at?: string | null
          id?: string
          pack_size: number
          price_paid?: number | null
          stripe_item_id?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean | null
          asaas_subscription_id?: string | null
          created_at?: string | null
          id?: string
          pack_size?: number
          price_paid?: number | null
          stripe_item_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_packs_workspace_id_fkey"
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
          active_agent_id: string | null
          active_agent_set_at: string | null
          active_department_id: string | null
          ai_score: number | null
          ai_score_label: string | null
          ai_scored_at: string | null
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          instance_name: string | null
          is_ignored: boolean | null
          is_opted_out: boolean | null
          name: string
          notes: string | null
          phone: string
          position: number
          responsible_user: string | null
          source: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          value: number | null
          whatsapp_jid: string | null
          workspace_id: string
        }
        Insert: {
          active_agent_id?: string | null
          active_agent_set_at?: string | null
          active_department_id?: string | null
          ai_score?: number | null
          ai_score_label?: string | null
          ai_scored_at?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instance_name?: string | null
          is_ignored?: boolean | null
          is_opted_out?: boolean | null
          name: string
          notes?: string | null
          phone: string
          position?: number
          responsible_user?: string | null
          source?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number | null
          whatsapp_jid?: string | null
          workspace_id: string
        }
        Update: {
          active_agent_id?: string | null
          active_agent_set_at?: string | null
          active_department_id?: string | null
          ai_score?: number | null
          ai_score_label?: string | null
          ai_scored_at?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instance_name?: string | null
          is_ignored?: boolean | null
          is_opted_out?: boolean | null
          name?: string
          notes?: string | null
          phone?: string
          position?: number
          responsible_user?: string | null
          source?: string | null
          stage_id?: string | null
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
      member_permissions: {
        Row: {
          allowed_instance_ids: string[] | null
          allowed_pages: string[] | null
          can_create_instances: boolean
          can_create_leads: boolean
          can_delete_leads: boolean
          can_edit_leads: boolean
          can_export_data: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          allowed_instance_ids?: string[] | null
          allowed_pages?: string[] | null
          can_create_instances?: boolean
          can_create_leads?: boolean
          can_delete_leads?: boolean
          can_edit_leads?: boolean
          can_export_data?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          allowed_instance_ids?: string[] | null
          allowed_pages?: string[] | null
          can_create_instances?: boolean
          can_create_leads?: boolean
          can_delete_leads?: boolean
          can_edit_leads?: boolean
          can_export_data?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_workspace_id_fkey"
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
      notification_preferences: {
        Row: {
          created_at: string | null
          daily_report_enabled: boolean | null
          daily_report_time: string | null
          id: string
          manager_report_day_of_week: number | null
          manager_report_enabled: boolean | null
          manager_report_frequency: string | null
          manager_report_time: string | null
          new_lead_alert_enabled: boolean | null
          no_response_enabled: boolean | null
          no_response_minutes: number | null
          updated_at: string | null
          user_profile_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          daily_report_enabled?: boolean | null
          daily_report_time?: string | null
          id?: string
          manager_report_day_of_week?: number | null
          manager_report_enabled?: boolean | null
          manager_report_frequency?: string | null
          manager_report_time?: string | null
          new_lead_alert_enabled?: boolean | null
          no_response_enabled?: boolean | null
          no_response_minutes?: number | null
          updated_at?: string | null
          user_profile_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          daily_report_enabled?: boolean | null
          daily_report_time?: string | null
          id?: string
          manager_report_day_of_week?: number | null
          manager_report_enabled?: boolean | null
          manager_report_frequency?: string | null
          manager_report_time?: string | null
          new_lead_alert_enabled?: boolean | null
          no_response_enabled?: boolean | null
          no_response_minutes?: number | null
          updated_at?: string | null
          user_profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_workspace_id_fkey"
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
      pre_billing_cadence_config: {
        Row: {
          assunto: string
          ativo: boolean
          corpo: string
          email_type: string
          id: string
          updated_at: string
        }
        Insert: {
          assunto: string
          ativo?: boolean
          corpo: string
          email_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          ativo?: boolean
          corpo?: string
          email_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pre_billing_email_logs: {
        Row: {
          error_message: string | null
          id: string
          resend_message_id: string | null
          status_entrega: string
          timestamp_envio: string
          tipo_email: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          resend_message_id?: string | null
          status_entrega?: string
          timestamp_envio?: string
          tipo_email: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          resend_message_id?: string | null
          status_entrega?: string
          timestamp_envio?: string
          tipo_email?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_billing_email_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_cadence_config: {
        Row: {
          cadence_days: Json
          created_at: string
          email_subject: string
          email_template: string
          id: string
          is_active: boolean
          send_email: boolean
          send_whatsapp: boolean
          updated_at: string
          welcome_message_template: string | null
          whatsapp_instance_name: string | null
          whatsapp_template: string
        }
        Insert: {
          cadence_days?: Json
          created_at?: string
          email_subject?: string
          email_template?: string
          id?: string
          is_active?: boolean
          send_email?: boolean
          send_whatsapp?: boolean
          updated_at?: string
          welcome_message_template?: string | null
          whatsapp_instance_name?: string | null
          whatsapp_template?: string
        }
        Update: {
          cadence_days?: Json
          created_at?: string
          email_subject?: string
          email_template?: string
          id?: string
          is_active?: boolean
          send_email?: boolean
          send_whatsapp?: boolean
          updated_at?: string
          welcome_message_template?: string | null
          whatsapp_instance_name?: string | null
          whatsapp_template?: string
        }
        Relationships: []
      }
      reactivation_campaigns: {
        Row: {
          asaas_customer_id: string | null
          campaign_batch: string | null
          client_name: string | null
          created_at: string
          id: string
          message_sent: string | null
          phone: string
          plan_name: string | null
          resolved_at: string | null
          sent_at: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          campaign_batch?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          message_sent?: string | null
          phone: string
          plan_name?: string | null
          resolved_at?: string | null
          sent_at?: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          campaign_batch?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          message_sent?: string | null
          phone?: string
          plan_name?: string | null
          resolved_at?: string | null
          sent_at?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_log: {
        Row: {
          cadence_day: number
          channel: string
          error_message: string | null
          id: string
          sent_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          cadence_day: number
          channel: string
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          workspace_id: string
        }
        Update: {
          cadence_day?: number
          channel?: string
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      salesbot_wait_queue: {
        Row: {
          bot_id: string
          canceled_reason: string | null
          condition_id: string
          condition_type: string
          created_at: string | null
          execute_at: string | null
          executed_at: string | null
          id: string
          lead_id: string
          session_id: string | null
          started_at: string
          status: string
          target_node_id: string
          wait_node_id: string
          workspace_id: string
        }
        Insert: {
          bot_id: string
          canceled_reason?: string | null
          condition_id: string
          condition_type: string
          created_at?: string | null
          execute_at?: string | null
          executed_at?: string | null
          id?: string
          lead_id: string
          session_id?: string | null
          started_at?: string
          status?: string
          target_node_id: string
          wait_node_id: string
          workspace_id: string
        }
        Update: {
          bot_id?: string
          canceled_reason?: string | null
          condition_id?: string
          condition_type?: string
          created_at?: string | null
          execute_at?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string
          session_id?: string | null
          started_at?: string
          status?: string
          target_node_id?: string
          wait_node_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salesbot_wait_queue_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "salesbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesbot_wait_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesbot_wait_queue_workspace_id_fkey"
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
          template_name: string | null
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
          template_name?: string | null
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
          template_name?: string | null
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
          metadata: string | null
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
          metadata?: string | null
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
          metadata?: string | null
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
      stage_automation_queue: {
        Row: {
          automation_id: string
          created_at: string
          execute_at: string
          executed_at: string | null
          id: string
          lead_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          execute_at: string
          executed_at?: string | null
          id?: string
          lead_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          execute_at?: string
          executed_at?: string | null
          id?: string
          lead_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_automation_queue_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "stage_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_automation_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_automation_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_automations: {
        Row: {
          action_config: Json
          action_type: string
          conditions: Json | null
          created_at: string
          id: string
          is_active: boolean
          position: number
          stage_id: string
          trigger: string
          trigger_delay_minutes: number | null
          workspace_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          conditions?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          stage_id: string
          trigger?: string
          trigger_delay_minutes?: number | null
          workspace_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          conditions?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          stage_id?: string
          trigger?: string
          trigger_delay_minutes?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_automations_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string | null
          sender_type: string
          ticket_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_type?: string
          ticket_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          queue_item_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          queue_item_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          queue_item_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_notes_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "human_support_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          instance_name: string | null
          lead_id: string | null
          lead_name: string | null
          lead_phone: string | null
          priority: string
          queue_item_id: string | null
          resolved_at: string | null
          session_id: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          priority?: string
          queue_item_id?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          priority?: string
          queue_item_id?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets_backup_20260416: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string | null
          priority: string | null
          resolved_at: string | null
          status: string | null
          subject: string | null
          updated_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
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
          personal_whatsapp: string | null
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
          personal_whatsapp?: string | null
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
          personal_whatsapp?: string | null
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
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          next_retry_at: string | null
          payload: Json
          payload_id: string | null
          response_body: string | null
          response_status: number | null
          status: string
          webhook_id: string
          workspace_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          payload_id?: string | null
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_id: string
          workspace_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          payload_id?: string | null
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_message_log: {
        Row: {
          id: string
          message_id: string
          processed_at: string | null
          session_id: string
          workspace_id: string | null
        }
        Insert: {
          id?: string
          message_id: string
          processed_at?: string | null
          session_id: string
          workspace_id?: string | null
        }
        Update: {
          id?: string
          message_id?: string
          processed_at?: string | null
          session_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: Json
          id: string
          is_active: boolean
          secret_hash: string
          secret_prefix: string
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: Json
          id?: string
          is_active?: boolean
          secret_hash: string
          secret_prefix: string
          updated_at?: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: Json
          id?: string
          is_active?: boolean
          secret_hash?: string
          secret_prefix?: string
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_cloud_connections: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          inbox_name: string
          is_active: boolean | null
          last_webhook_at: string | null
          meta_page_id: string | null
          phone_number: string
          phone_number_id: string
          status: string | null
          updated_at: string | null
          waba_id: string
          webhook_verify_token: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          inbox_name: string
          is_active?: boolean | null
          last_webhook_at?: string | null
          meta_page_id?: string | null
          phone_number: string
          phone_number_id: string
          status?: string | null
          updated_at?: string | null
          waba_id: string
          webhook_verify_token?: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          inbox_name?: string
          is_active?: boolean | null
          last_webhook_at?: string | null
          meta_page_id?: string | null
          phone_number?: string
          phone_number_id?: string
          status?: string | null
          updated_at?: string | null
          waba_id?: string
          webhook_verify_token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_cloud_connections_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_cloud_connections_workspace_id_fkey"
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
          instance_type: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          id?: string
          instance_name: string
          instance_type?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          id?: string
          instance_name?: string
          instance_type?: string
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
      whatsapp_messages: {
        Row: {
          content: string | null
          created_at: string
          direction: string
          from_me: boolean | null
          id: string
          instance_name: string
          message_id: string | null
          message_type: string | null
          push_name: string | null
          remote_jid: string
          timestamp: string
          workspace_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          direction: string
          from_me?: boolean | null
          id?: string
          instance_name: string
          message_id?: string | null
          message_type?: string | null
          push_name?: string | null
          remote_jid: string
          timestamp?: string
          workspace_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          direction?: string
          from_me?: boolean | null
          id?: string
          instance_name?: string
          message_id?: string | null
          message_type?: string | null
          push_name?: string | null
          remote_jid?: string
          timestamp?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string
          cloud_connection_id: string
          components: Json
          created_at: string
          id: string
          language: string
          status: string
          synced_at: string
          template_id: string
          template_name: string
          variable_mappings: Json | null
          workspace_id: string
        }
        Insert: {
          category?: string
          cloud_connection_id: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          status?: string
          synced_at?: string
          template_id: string
          template_name: string
          variable_mappings?: Json | null
          workspace_id: string
        }
        Update: {
          category?: string
          cloud_connection_id?: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          status?: string
          synced_at?: string
          template_id?: string
          template_name?: string
          variable_mappings?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_cloud_connection_id_fkey"
            columns: ["cloud_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_cloud_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_workspace_id_fkey"
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
          ai_interactions_limit: number | null
          ai_interactions_used: number | null
          ai_reset_at: string | null
          alert_instance_name: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          blocked_at: string | null
          created_at: string
          created_by: string
          extra_leads: number | null
          form_default_stage_id: string | null
          form_field_mapping: Json | null
          form_webhook_token: string | null
          id: string
          is_promo_trial: boolean | null
          lead_limit: number | null
          logo_url: string | null
          meta_conversions_token: string | null
          meta_pixel_id: string | null
          name: string
          onboarding_completed: boolean | null
          onboarding_step: number | null
          payment_provider: string | null
          plan_name: string | null
          plan_type: string
          promo_campaign: string | null
          promo_locked_until: string | null
          promo_starts_at: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          support_whatsapp_instance: string | null
          support_whatsapp_number: string | null
          trial_end: string | null
          user_limit: number | null
          whatsapp_limit: number | null
        }
        Insert: {
          ai_interactions_limit?: number | null
          ai_interactions_used?: number | null
          ai_reset_at?: string | null
          alert_instance_name?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          blocked_at?: string | null
          created_at?: string
          created_by: string
          extra_leads?: number | null
          form_default_stage_id?: string | null
          form_field_mapping?: Json | null
          form_webhook_token?: string | null
          id?: string
          is_promo_trial?: boolean | null
          lead_limit?: number | null
          logo_url?: string | null
          meta_conversions_token?: string | null
          meta_pixel_id?: string | null
          name: string
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          payment_provider?: string | null
          plan_name?: string | null
          plan_type?: string
          promo_campaign?: string | null
          promo_locked_until?: string | null
          promo_starts_at?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          support_whatsapp_instance?: string | null
          support_whatsapp_number?: string | null
          trial_end?: string | null
          user_limit?: number | null
          whatsapp_limit?: number | null
        }
        Update: {
          ai_interactions_limit?: number | null
          ai_interactions_used?: number | null
          ai_reset_at?: string | null
          alert_instance_name?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          blocked_at?: string | null
          created_at?: string
          created_by?: string
          extra_leads?: number | null
          form_default_stage_id?: string | null
          form_field_mapping?: Json | null
          form_webhook_token?: string | null
          id?: string
          is_promo_trial?: boolean | null
          lead_limit?: number | null
          logo_url?: string | null
          meta_conversions_token?: string | null
          meta_pixel_id?: string | null
          name?: string
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          payment_provider?: string | null
          plan_name?: string | null
          plan_type?: string
          promo_campaign?: string | null
          promo_locked_until?: string | null
          promo_starts_at?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          support_whatsapp_instance?: string | null
          support_whatsapp_number?: string | null
          trial_end?: string | null
          user_limit?: number | null
          whatsapp_limit?: number | null
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
      claim_lead_agent: {
        Args: { _agent_id: string; _department_id?: string; _lead_id: string }
        Returns: boolean
      }
      clone_workspace: {
        Args: {
          _new_name: string
          _new_slug: string
          _owner_user_id: string
          _source_workspace_id: string
        }
        Returns: string
      }
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
      meta_platform: "facebook" | "instagram" | "both" | "whatsapp_business"
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
      meta_platform: ["facebook", "instagram", "both", "whatsapp_business"],
    },
  },
} as const
