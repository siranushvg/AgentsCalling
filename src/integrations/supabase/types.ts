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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string
          actor_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          details: string | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          details?: string | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      admin_test_messages: {
        Row: {
          admin_id: string
          channel: string
          id: string
          is_test: boolean
          message_content: string
          provider: string
          provider_reason: string | null
          provider_status: string | null
          raw_response: Json | null
          sent_at: string
          test_number: string
        }
        Insert: {
          admin_id: string
          channel: string
          id?: string
          is_test?: boolean
          message_content: string
          provider: string
          provider_reason?: string | null
          provider_status?: string | null
          raw_response?: Json | null
          sent_at?: string
          test_number: string
        }
        Update: {
          admin_id?: string
          channel?: string
          id?: string
          is_test?: boolean
          message_content?: string
          provider?: string
          provider_reason?: string | null
          provider_status?: string | null
          raw_response?: Json | null
          sent_at?: string
          test_number?: string
        }
        Relationships: []
      }
      agent_onboarding: {
        Row: {
          aadhar_number: string
          agent_id: string
          bank_account_name: string
          bank_account_number: string
          bank_ifsc: string
          bank_name: string
          created_at: string
          custom_fields: Json
          fathers_name: string
          full_name: string
          id: string
          offer_letter_confirmed: boolean
          offer_letter_confirmed_at: string | null
          onboarding_status: string
          referred_by_code: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          aadhar_number?: string
          agent_id: string
          bank_account_name?: string
          bank_account_number?: string
          bank_ifsc?: string
          bank_name?: string
          created_at?: string
          custom_fields?: Json
          fathers_name?: string
          full_name?: string
          id?: string
          offer_letter_confirmed?: boolean
          offer_letter_confirmed_at?: string | null
          onboarding_status?: string
          referred_by_code?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          aadhar_number?: string
          agent_id?: string
          bank_account_name?: string
          bank_account_number?: string
          bank_ifsc?: string
          bank_name?: string
          created_at?: string
          custom_fields?: Json
          fathers_name?: string
          full_name?: string
          id?: string
          offer_letter_confirmed?: boolean
          offer_letter_confirmed_at?: string | null
          onboarding_status?: string
          referred_by_code?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_onboarding_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessions: {
        Row: {
          active_minutes: number
          agent_id: string
          device_info: string | null
          id: string
          idle_minutes: number
          ip_address: string | null
          login_at: string
          logout_at: string | null
          shift_date: string
        }
        Insert: {
          active_minutes?: number
          agent_id: string
          device_info?: string | null
          id?: string
          idle_minutes?: number
          ip_address?: string | null
          login_at?: string
          logout_at?: string | null
          shift_date?: string
        }
        Update: {
          active_minutes?: number
          agent_id?: string
          device_info?: string | null
          id?: string
          idle_minutes?: number
          ip_address?: string | null
          login_at?: string
          logout_at?: string | null
          shift_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_shifts: {
        Row: {
          agent_id: string
          created_at: string
          date: string
          id: string
          is_off_day: boolean
          override_reason: string | null
          shift_template_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          date: string
          id?: string
          is_off_day?: boolean
          override_reason?: string | null
          shift_template_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          date?: string
          id?: string
          is_off_day?: boolean
          override_reason?: string | null
          shift_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_shifts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_shifts_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_training_modules: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          module_id: number
          passed: boolean
          passed_at: string | null
          score: number | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          module_id: number
          passed?: boolean
          passed_at?: string | null
          score?: number | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          module_id?: number
          passed?: boolean
          passed_at?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_training_modules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          city: string
          created_at: string
          email: string
          full_name: string
          id: string
          joining_date: string | null
          languages: string[]
          monthly_salary: number
          phone: string
          referral_code: string
          referred_by: string | null
          status: Database["public"]["Enums"]["agent_status"]
          team_lead_id: string | null
          training_completed: boolean
          training_progress: number
          updated_at: string
          user_id: string | null
          voicelay_agent_id: string | null
          voicelay_contact_number: string | null
          voicelay_extension: number | null
          voicelay_sso_token: string | null
          voicelay_username: string | null
          voicelay_virtual_number: string | null
        }
        Insert: {
          city: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          joining_date?: string | null
          languages?: string[]
          monthly_salary?: number
          phone: string
          referral_code: string
          referred_by?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          team_lead_id?: string | null
          training_completed?: boolean
          training_progress?: number
          updated_at?: string
          user_id?: string | null
          voicelay_agent_id?: string | null
          voicelay_contact_number?: string | null
          voicelay_extension?: number | null
          voicelay_sso_token?: string | null
          voicelay_username?: string | null
          voicelay_virtual_number?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          joining_date?: string | null
          languages?: string[]
          monthly_salary?: number
          phone?: string
          referral_code?: string
          referred_by?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          team_lead_id?: string | null
          training_completed?: boolean
          training_progress?: number
          updated_at?: string
          user_id?: string | null
          voicelay_agent_id?: string | null
          voicelay_contact_number?: string | null
          voicelay_extension?: number | null
          voicelay_sso_token?: string | null
          voicelay_username?: string | null
          voicelay_virtual_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_overrides: {
        Row: {
          agent_id: string
          created_at: string
          date: string
          id: string
          original_status: string
          overridden_by: string
          override_reason: string | null
          override_status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          date: string
          id?: string
          original_status: string
          overridden_by: string
          override_reason?: string | null
          override_status: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          date?: string
          id?: string
          original_status?: string
          overridden_by?: string
          override_reason?: string | null
          override_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_overrides_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_requests: {
        Row: {
          agent_id: string
          created_at: string
          current_status: string
          date: string
          id: string
          reason: string | null
          requested_status: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          current_status: string
          date: string
          id?: string
          reason?: string | null
          requested_status: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          current_status?: string
          date?: string
          id?: string
          reason?: string | null
          requested_status?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      bo_agent_mappings: {
        Row: {
          agent_id: string
          agent_name: string
          bo_response: Json | null
          bo_user_id: string
          created_at: string
          id: string
          last_error: string | null
          lead_id: string
          mapping_reason: string
          previous_agent_id: string | null
          previous_agent_name: string | null
          retry_count: number
          sync_status: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_name: string
          bo_response?: Json | null
          bo_user_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_id: string
          mapping_reason?: string
          previous_agent_id?: string | null
          previous_agent_name?: string | null
          retry_count?: number
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_name?: string
          bo_response?: Json | null
          bo_user_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_id?: string
          mapping_reason?: string
          previous_agent_id?: string | null
          previous_agent_name?: string | null
          retry_count?: number
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bo_agent_mappings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bo_agent_mappings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bo_agent_mappings_previous_agent_id_fkey"
            columns: ["previous_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      call_campaigns: {
        Row: {
          active_hours_end: string
          active_hours_start: string
          assigned_count: number
          completed_count: number
          converted_count: number
          created_at: string
          created_by: string | null
          description: string | null
          distribution_strategy: string
          end_date: string | null
          id: string
          max_attempts: number
          name: string
          queue_id: string | null
          retry_intervals: Json
          script_template: string | null
          start_date: string
          status: string
          suppression_rules: Json
          target_segment: Json
          total_users: number
          updated_at: string
        }
        Insert: {
          active_hours_end?: string
          active_hours_start?: string
          assigned_count?: number
          completed_count?: number
          converted_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          distribution_strategy?: string
          end_date?: string | null
          id?: string
          max_attempts?: number
          name: string
          queue_id?: string | null
          retry_intervals?: Json
          script_template?: string | null
          start_date?: string
          status?: string
          suppression_rules?: Json
          target_segment?: Json
          total_users?: number
          updated_at?: string
        }
        Update: {
          active_hours_end?: string
          active_hours_start?: string
          assigned_count?: number
          completed_count?: number
          converted_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          distribution_strategy?: string
          end_date?: string | null
          id?: string
          max_attempts?: number
          name?: string
          queue_id?: string | null
          retry_intervals?: Json
          script_template?: string | null
          start_date?: string
          status?: string
          suppression_rules?: Json
          target_segment?: Json
          total_users?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_campaigns_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queue_members: {
        Row: {
          added_at: string
          assigned_agent_id: string | null
          attempt_count: number
          campaign_id: string | null
          id: string
          last_outcome: string | null
          lead_id: string
          position: number
          priority_score: number
          queue_id: string
          retry_after: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          assigned_agent_id?: string | null
          attempt_count?: number
          campaign_id?: string | null
          id?: string
          last_outcome?: string | null
          lead_id: string
          position?: number
          priority_score?: number
          queue_id: string
          retry_after?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          assigned_agent_id?: string | null
          attempt_count?: number
          campaign_id?: string | null
          id?: string
          last_outcome?: string | null
          lead_id?: string
          position?: number
          priority_score?: number
          queue_id?: string
          retry_after?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_members_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_members_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_members_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queues: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          priority_rules: Json
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          priority_rules?: Json
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          priority_rules?: Json
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_queues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_id: string
          attempt_number: number
          call_mode: string
          caller_number: string | null
          campaign_id: string | null
          connected_duration_seconds: number | null
          disposition: Database["public"]["Enums"]["disposition_type"] | null
          duration_seconds: number
          ended_at: string | null
          ftd_verified: boolean
          id: string
          lead_id: string | null
          notes: string | null
          provider_call_id: string | null
          provider_payload: Json | null
          queue_id: string | null
          recording_url: string | null
          ringing_duration_seconds: number | null
          session_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          synced_from_voicelay_at: string | null
        }
        Insert: {
          agent_id: string
          attempt_number?: number
          call_mode?: string
          caller_number?: string | null
          campaign_id?: string | null
          connected_duration_seconds?: number | null
          disposition?: Database["public"]["Enums"]["disposition_type"] | null
          duration_seconds?: number
          ended_at?: string | null
          ftd_verified?: boolean
          id?: string
          lead_id?: string | null
          notes?: string | null
          provider_call_id?: string | null
          provider_payload?: Json | null
          queue_id?: string | null
          recording_url?: string | null
          ringing_duration_seconds?: number | null
          session_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          synced_from_voicelay_at?: string | null
        }
        Update: {
          agent_id?: string
          attempt_number?: number
          call_mode?: string
          caller_number?: string | null
          campaign_id?: string | null
          connected_duration_seconds?: number | null
          disposition?: Database["public"]["Enums"]["disposition_type"] | null
          duration_seconds?: number
          ended_at?: string | null
          ftd_verified?: boolean
          id?: string
          lead_id?: string | null
          notes?: string | null
          provider_call_id?: string | null
          provider_payload?: Json | null
          queue_id?: string | null
          recording_url?: string | null
          ringing_duration_seconds?: number | null
          session_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          synced_from_voicelay_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_agents: {
        Row: {
          agent_id: string
          assigned_at: string
          assigned_count: number
          campaign_id: string
          completed_count: number
          converted_count: number
          id: string
          status: string
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          assigned_count?: number
          campaign_id: string
          completed_count?: number
          converted_count?: number
          id?: string
          status?: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          assigned_count?: number
          campaign_id?: string
          completed_count?: number
          converted_count?: number
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_agents_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          created_at: string
          created_by: string | null
          direct_rate: number
          effective_from: string
          id: string
          tier2_rate: number
          tier3_rate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direct_rate: number
          effective_from: string
          id?: string
          tier2_rate: number
          tier3_rate: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direct_rate?: number
          effective_from?: string
          id?: string
          tier2_rate?: number
          tier3_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          id: string
          lead_id: string
          rate_used: number
          reassignment_split: boolean
          split_percentage: number | null
          tier: string
          tier2_agent_id: string | null
          tier3_agent_id: string | null
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          id?: string
          lead_id: string
          rate_used: number
          reassignment_split?: boolean
          split_percentage?: number | null
          tier: string
          tier2_agent_id?: string | null
          tier3_agent_id?: string | null
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string
          rate_used?: number
          reassignment_split?: boolean
          split_percentage?: number | null
          tier?: string
          tier2_agent_id?: string | null
          tier3_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_tier2_agent_id_fkey"
            columns: ["tier2_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_tier3_agent_id_fkey"
            columns: ["tier3_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_imports: {
        Row: {
          admin_user_id: string
          created_at: string
          error_details: Json | null
          failed_count: number
          file_name: string
          id: string
          import_batch_id: string | null
          import_mode: string
          imported_count: number
          skipped_count: number
          status: string
          total_rows: number
          updated_count: number
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          error_details?: Json | null
          failed_count?: number
          file_name: string
          id?: string
          import_batch_id?: string | null
          import_mode?: string
          imported_count?: number
          skipped_count?: number
          status?: string
          total_rows?: number
          updated_count?: number
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          error_details?: Json | null
          failed_count?: number
          file_name?: string
          id?: string
          import_batch_id?: string | null
          import_mode?: string
          imported_count?: number
          skipped_count?: number
          status?: string
          total_rows?: number
          updated_count?: number
        }
        Relationships: []
      }
      early_login_requests: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          requested_at: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shift_date: string
          shift_start_time: string
          status: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date?: string
          shift_start_time: string
          status?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date?: string
          shift_start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "early_login_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ftd_events: {
        Row: {
          agent_id: string | null
          call_id: string | null
          created_at: string
          deposit_amount: number
          external_reference: string | null
          id: string
          lead_id: string | null
          matched_at: string | null
          phone_number: string | null
          source: string
          username: string | null
          verified: boolean
        }
        Insert: {
          agent_id?: string | null
          call_id?: string | null
          created_at?: string
          deposit_amount?: number
          external_reference?: string | null
          id?: string
          lead_id?: string | null
          matched_at?: string | null
          phone_number?: string | null
          source?: string
          username?: string | null
          verified?: boolean
        }
        Update: {
          agent_id?: string | null
          call_id?: string | null
          created_at?: string
          deposit_amount?: number
          external_reference?: string | null
          id?: string
          lead_id?: string | null
          matched_at?: string | null
          phone_number?: string | null
          source?: string
          username?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ftd_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ftd_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ftd_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "inbound_call_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ftd_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_conversations: {
        Row: {
          archived_at: string | null
          category: string
          created_at: string
          id: string
          is_important: boolean
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category?: string
          created_at?: string
          id?: string
          is_important?: boolean
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          created_at?: string
          id?: string
          is_important?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_agent_id: string | null
          bo_sync_error: string | null
          bo_sync_status: string | null
          bo_synced_at: string | null
          bo_user_id: string | null
          call_lock_agent_id: string | null
          call_lock_expires_at: string | null
          call_priority: number
          campaign_id: string | null
          created_at: string
          email: string | null
          id: string
          import_batch_id: string | null
          import_date: string | null
          import_timestamp: string | null
          imported_by_admin: string | null
          language: string
          last_called_at: string | null
          normalized_phone: string
          phone_number: string
          potential_commission: number
          score: number
          signup_at: string
          source: Database["public"]["Enums"]["lead_source"]
          state: string
          status: Database["public"]["Enums"]["lead_status"]
          suppressed: boolean
          suppression_reason: string | null
          temperature: Database["public"]["Enums"]["lead_temperature"]
          total_call_attempts: number
          updated_at: string
          username: string
        }
        Insert: {
          assigned_agent_id?: string | null
          bo_sync_error?: string | null
          bo_sync_status?: string | null
          bo_synced_at?: string | null
          bo_user_id?: string | null
          call_lock_agent_id?: string | null
          call_lock_expires_at?: string | null
          call_priority?: number
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          import_batch_id?: string | null
          import_date?: string | null
          import_timestamp?: string | null
          imported_by_admin?: string | null
          language: string
          last_called_at?: string | null
          normalized_phone?: string
          phone_number: string
          potential_commission?: number
          score?: number
          signup_at?: string
          source?: Database["public"]["Enums"]["lead_source"]
          state: string
          status?: Database["public"]["Enums"]["lead_status"]
          suppressed?: boolean
          suppression_reason?: string | null
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          total_call_attempts?: number
          updated_at?: string
          username: string
        }
        Update: {
          assigned_agent_id?: string | null
          bo_sync_error?: string | null
          bo_sync_status?: string | null
          bo_synced_at?: string | null
          bo_user_id?: string | null
          call_lock_agent_id?: string | null
          call_lock_expires_at?: string | null
          call_priority?: number
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          import_batch_id?: string | null
          import_date?: string | null
          import_timestamp?: string | null
          imported_by_admin?: string | null
          language?: string
          last_called_at?: string | null
          normalized_phone?: string
          phone_number?: string
          potential_commission?: number
          score?: number
          signup_at?: string
          source?: Database["public"]["Enums"]["lead_source"]
          state?: string
          status?: Database["public"]["Enums"]["lead_status"]
          suppressed?: boolean
          suppression_reason?: string | null
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          total_call_attempts?: number
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_call_lock_agent_id_fkey"
            columns: ["call_lock_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      low_activity_flags: {
        Row: {
          agent_id: string
          created_at: string
          details: string | null
          flag_type: string
          id: string
          resolved: boolean
          resolved_by: string | null
          severity: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          details?: string | null
          flag_type: string
          id?: string
          resolved?: boolean
          resolved_by?: string | null
          severity: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          details?: string | null
          flag_type?: string
          id?: string
          resolved?: boolean
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "low_activity_flags_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_activity_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_id: string
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          delivery_status: string
          id: string
          lead_id: string
          sent_at: string
          template_id: string | null
        }
        Insert: {
          agent_id: string
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          delivery_status?: string
          id?: string
          lead_id: string
          sent_at?: string
          template_id?: string | null
        }
        Update: {
          agent_id?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          content?: string
          delivery_status?: string
          id?: string
          lead_id?: string
          sent_at?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      mg_payments: {
        Row: {
          active_hours: number
          agent_id: string
          amount: number
          created_at: string
          eligibility: Database["public"]["Enums"]["mg_eligibility"]
          id: string
          month: string
          reason: string | null
          status: Database["public"]["Enums"]["mg_payment_status"]
        }
        Insert: {
          active_hours?: number
          agent_id: string
          amount: number
          created_at?: string
          eligibility?: Database["public"]["Enums"]["mg_eligibility"]
          id?: string
          month: string
          reason?: string | null
          status?: Database["public"]["Enums"]["mg_payment_status"]
        }
        Update: {
          active_hours?: number
          agent_id?: string
          amount?: number
          created_at?: string
          eligibility?: Database["public"]["Enums"]["mg_eligibility"]
          id?: string
          month?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["mg_payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "mg_payments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_custom_fields: {
        Row: {
          created_at: string
          display_order: number
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          options: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_label: string
          field_name: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_documents: {
        Row: {
          agent_id: string
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          id: string
          storage_path: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          id?: string
          storage_path: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          agent_id: string
          commission_earned: number
          created_at: string
          id: string
          mg_paid: number
          net_payout: number
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          agent_id: string
          commission_earned?: number
          created_at?: string
          id?: string
          mg_paid?: number
          net_payout?: number
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          agent_id?: string
          commission_earned?: number
          created_at?: string
          id?: string
          mg_paid?: number
          net_payout?: number
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payouts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_activity_at: string | null
          last_logout_reason: string | null
          session_status: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_activity_at?: string | null
          last_logout_reason?: string | null
          session_status?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_activity_at?: string | null
          last_logout_reason?: string | null
          session_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qa_scorecards: {
        Row: {
          agent_id: string
          call_id: string
          closing: number
          compliance: number
          created_at: string
          flagged_for_admin: boolean
          id: string
          notes: string | null
          objection_handling: number
          opening: number
          reviewer_id: string
          script_adherence: number
          total: number | null
        }
        Insert: {
          agent_id: string
          call_id: string
          closing: number
          compliance: number
          created_at?: string
          flagged_for_admin?: boolean
          id?: string
          notes?: string | null
          objection_handling: number
          opening: number
          reviewer_id: string
          script_adherence: number
          total?: number | null
        }
        Update: {
          agent_id?: string
          call_id?: string
          closing?: number
          compliance?: number
          created_at?: string
          flagged_for_admin?: boolean
          id?: string
          notes?: string | null
          objection_handling?: number
          opening?: number
          reviewer_id?: string
          script_adherence?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_scorecards_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_scorecards_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_scorecards_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "inbound_call_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_scorecards_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payments: {
        Row: {
          agent_id: string
          basic_salary: number
          call_bonus: number
          calls_eligible: boolean
          calls_made: number
          created_at: string
          hours_eligible: boolean
          hours_logged: number
          id: string
          month: string
          status: string
          tier_name: string
          total_salary: number
        }
        Insert: {
          agent_id: string
          basic_salary?: number
          call_bonus?: number
          calls_eligible?: boolean
          calls_made?: number
          created_at?: string
          hours_eligible?: boolean
          hours_logged?: number
          id?: string
          month: string
          status?: string
          tier_name: string
          total_salary?: number
        }
        Update: {
          agent_id?: string
          basic_salary?: number
          call_bonus?: number
          calls_eligible?: boolean
          calls_made?: number
          created_at?: string
          hours_eligible?: boolean
          hours_logged?: number
          id?: string
          month?: string
          status?: string
          tier_name?: string
          total_salary?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_settings: {
        Row: {
          call_bonus_amount: number
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          min_calls_required: number
          min_hours_required: number
        }
        Insert: {
          call_bonus_amount?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          min_calls_required?: number
          min_hours_required?: number
        }
        Update: {
          call_bonus_amount?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          min_calls_required?: number
          min_hours_required?: number
        }
        Relationships: []
      }
      salary_tiers: {
        Row: {
          basic_salary: number
          created_at: string
          id: string
          max_tenure_months: number | null
          min_tenure_months: number
          name: string
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          id?: string
          max_tenure_months?: number | null
          min_tenure_months?: number
          name: string
        }
        Update: {
          basic_salary?: number
          created_at?: string
          id?: string
          max_tenure_months?: number | null
          min_tenure_months?: number
          name?: string
        }
        Relationships: []
      }
      scheduled_callbacks: {
        Row: {
          agent_id: string
          created_at: string
          disposition: string
          id: string
          lead_id: string
          lead_name: string
          reason: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          disposition: string
          id?: string
          lead_id: string
          lead_name: string
          reason?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          disposition?: string
          id?: string
          lead_id?: string
          lead_name?: string
          reason?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_callbacks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_callbacks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          created_at: string
          end_time: string
          id: string
          name: string
          start_time: string
          type: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          name: string
          start_time: string
          type: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          type?: Database["public"]["Enums"]["shift_type"]
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          fail_count: number | null
          id: string
          lead_id: string
          order_id: string | null
          phone_number: string
          provider: string
          provider_message_id: string | null
          provider_reason: string | null
          provider_status_code: number | null
          raw_response: Json | null
          sender_id: string | null
          sent_at: string | null
          status: string
          success_count: number | null
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          fail_count?: number | null
          id?: string
          lead_id: string
          order_id?: string | null
          phone_number: string
          provider?: string
          provider_message_id?: string | null
          provider_reason?: string | null
          provider_status_code?: number | null
          raw_response?: Json | null
          sender_id?: string | null
          sent_at?: string | null
          status?: string
          success_count?: number | null
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          fail_count?: number | null
          id?: string
          lead_id?: string
          order_id?: string | null
          phone_number?: string
          provider?: string
          provider_message_id?: string | null
          provider_reason?: string | null
          provider_status_code?: number | null
          raw_response?: Json | null
          sender_id?: string | null
          sent_at?: string | null
          status?: string
          success_count?: number | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          active: boolean
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel?: Database["public"]["Enums"]["message_channel"]
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
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
      whatsapp_conversations: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          last_message_at: string | null
          last_message_text: string | null
          last_synced_at: string | null
          lead_id: string | null
          phone_number: string
          unread_count: number
          updated_at: string
          wa_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          last_synced_at?: string | null
          lead_id?: string | null
          phone_number: string
          unread_count?: number
          updated_at?: string
          wa_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          last_synced_at?: string | null
          lead_id?: string | null
          phone_number?: string
          unread_count?: number
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          agent_id: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          id: string
          lead_id: string | null
          message_text: string | null
          provider: string
          provider_message_id: string | null
          read_at: string | null
          sent_at: string | null
          status: string
          template_name: string | null
        }
        Insert: {
          agent_id?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          id?: string
          lead_id?: string | null
          message_text?: string | null
          provider?: string
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
        }
        Update: {
          agent_id?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          id?: string
          lead_id?: string | null
          message_text?: string | null
          provider?: string
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inbound_call_recordings: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          call_mode: string | null
          caller_number: string | null
          disposition: Database["public"]["Enums"]["disposition_type"] | null
          duration_seconds: number | null
          ended_at: string | null
          id: string | null
          lead_id: string | null
          lead_phone: string | null
          lead_username: string | null
          notes: string | null
          recording_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["call_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_whatsapp_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      check_low_activity: { Args: { p_agent_id: string }; Returns: undefined }
      check_session_valid: { Args: { _user_id: string }; Returns: boolean }
      distribute_leads_to_agents: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      expire_stale_leads: { Args: never; Returns: undefined }
      generate_referral_code: { Args: { agent_name: string }; Returns: string }
      get_agent_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_dashboard_stats: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_referral_network: {
        Args: { _agent_id: string }
        Returns: {
          full_name: string
          id: string
          status: string
          tier: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      mark_session_timeout: { Args: { _user_id: string }; Returns: undefined }
      reap_stale_calls: { Args: never; Returns: Json }
      redistribute_agent_leads: { Args: { p_agent_id: string }; Returns: Json }
      redistribute_all_leads_equally: {
        Args: { p_trigger_reason?: string; p_triggered_by?: string }
        Returns: Json
      }
      update_last_activity: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      agent_status:
        | "pending"
        | "training"
        | "active"
        | "suspended"
        | "terminated"
      app_role: "agent" | "team_lead" | "admin"
      call_status:
        | "ringing"
        | "connected"
        | "on_hold"
        | "completed"
        | "missed"
        | "failed"
      disposition_type:
        | "interested"
        | "callback"
        | "not_interested"
        | "no_answer"
        | "wrong_number"
        | "language_mismatch"
        | "converted"
      lead_source: "ad_campaign" | "organic" | "direct"
      lead_status:
        | "new"
        | "assigned"
        | "contacted"
        | "callback"
        | "converted"
        | "expired"
        | "not_interested"
      lead_temperature: "hot" | "warm" | "cool"
      message_channel: "whatsapp" | "sms" | "rcs"
      mg_eligibility: "eligible" | "at_risk" | "not_eligible"
      mg_payment_status: "pending" | "paid" | "withheld" | "suspended"
      payout_status: "pending" | "processed" | "paid"
      shift_type: "morning" | "afternoon" | "evening" | "custom"
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
      agent_status: [
        "pending",
        "training",
        "active",
        "suspended",
        "terminated",
      ],
      app_role: ["agent", "team_lead", "admin"],
      call_status: [
        "ringing",
        "connected",
        "on_hold",
        "completed",
        "missed",
        "failed",
      ],
      disposition_type: [
        "interested",
        "callback",
        "not_interested",
        "no_answer",
        "wrong_number",
        "language_mismatch",
        "converted",
      ],
      lead_source: ["ad_campaign", "organic", "direct"],
      lead_status: [
        "new",
        "assigned",
        "contacted",
        "callback",
        "converted",
        "expired",
        "not_interested",
      ],
      lead_temperature: ["hot", "warm", "cool"],
      message_channel: ["whatsapp", "sms", "rcs"],
      mg_eligibility: ["eligible", "at_risk", "not_eligible"],
      mg_payment_status: ["pending", "paid", "withheld", "suspended"],
      payout_status: ["pending", "processed", "paid"],
      shift_type: ["morning", "afternoon", "evening", "custom"],
    },
  },
} as const
