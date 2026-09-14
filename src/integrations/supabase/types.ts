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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_messages: {
        Row: {
          activity_id: string
          body: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          activity_id: string
          body: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          activity_id?: string
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_messages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "employee_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          about: string | null
          address: string | null
          company_name: string
          currency: string
          email: string | null
          hold_minutes: number
          id: boolean
          logo_url: string | null
          maps_default_zoom: number
          max_pdf_mb: number
          max_property_images: number
          phone: string | null
          social_links: Json
          stats: Json
          timezone: string
          updated_at: string
          vat_rate: number
          whatsapp_number: string | null
        }
        Insert: {
          about?: string | null
          address?: string | null
          company_name?: string
          currency?: string
          email?: string | null
          hold_minutes?: number
          id?: boolean
          logo_url?: string | null
          maps_default_zoom?: number
          max_pdf_mb?: number
          max_property_images?: number
          phone?: string | null
          social_links?: Json
          stats?: Json
          timezone?: string
          updated_at?: string
          vat_rate?: number
          whatsapp_number?: string | null
        }
        Update: {
          about?: string | null
          address?: string | null
          company_name?: string
          currency?: string
          email?: string | null
          hold_minutes?: number
          id?: boolean
          logo_url?: string | null
          maps_default_zoom?: number
          max_pdf_mb?: number
          max_property_images?: number
          phone?: string | null
          social_links?: Json
          stats?: Json
          timezone?: string
          updated_at?: string
          vat_rate?: number
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      automation_config: {
        Row: {
          enabled: boolean
          events: Json
          id: boolean
          shared_token: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          enabled?: boolean
          events?: Json
          id?: boolean
          shared_token?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          enabled?: boolean
          events?: Json
          id?: boolean
          shared_token?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      automation_events: {
        Row: {
          created_at: string
          direction: string
          event: string
          id: string
          payload: Json | null
          response: string | null
          status: string
        }
        Insert: {
          created_at?: string
          direction?: string
          event: string
          id?: string
          payload?: Json | null
          response?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          event?: string
          id?: string
          payload?: Json | null
          response?: string | null
          status?: string
        }
        Relationships: []
      }
      automation_job_state: {
        Row: {
          consecutive_failures: number
          job_name: string
          last_error: string | null
          last_finished_at: string | null
          last_started_at: string | null
          lease_until: string | null
          status: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          job_name: string
          last_error?: string | null
          last_finished_at?: string | null
          last_started_at?: string | null
          lease_until?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          job_name?: string
          last_error?: string | null
          last_finished_at?: string | null
          last_started_at?: string | null
          lease_until?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          requested_by: string | null
          size_bytes: number | null
          status: string
          tables_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          requested_by?: string | null
          size_bytes?: number | null
          status?: string
          tables_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          requested_by?: string | null
          size_bytes?: number | null
          status?: string
          tables_count?: number
        }
        Relationships: []
      }
      buildings: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          district: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          login_email: string
          user_id: string
          username: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          login_email: string
          user_id: string
          username: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          login_email?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          assigned_to: string | null
          budget_max: number | null
          budget_min: number | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          interested_property_type: string | null
          is_active: boolean
          kind: string
          national_id: string | null
          notes: string | null
          phone: string | null
          phone_alt: string | null
          preferred_districts: string[] | null
          roles: string[]
          source: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          interested_property_type?: string | null
          is_active?: boolean
          kind?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          phone_alt?: string | null
          preferred_districts?: string[] | null
          roles?: string[]
          source?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          interested_property_type?: string | null
          is_active?: boolean
          kind?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          phone_alt?: string | null
          preferred_districts?: string[] | null
          roles?: string[]
          source?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_imports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contract_id: string | null
          created_at: string
          error_message: string | null
          extraction: Json
          field_sources: Json
          file_hash: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          ocr_used: boolean
          pages: number | null
          reviewed_by: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
          warnings: Json
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contract_id?: string | null
          created_at?: string
          error_message?: string | null
          extraction?: Json
          field_sources?: Json
          file_hash?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          ocr_used?: boolean
          pages?: number | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          warnings?: Json
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contract_id?: string | null
          created_at?: string
          error_message?: string | null
          extraction?: Json
          field_sources?: Json
          file_hash?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          ocr_used?: boolean
          pages?: number | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_imports_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_payments: {
        Row: {
          amount_due: number
          amount_paid: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          is_derived: boolean
          notes: string | null
          payment_number: number
          status: string
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          is_derived?: boolean
          notes?: string | null
          payment_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          is_derived?: boolean
          notes?: string | null
          payment_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_id: string
          created_at: string
          created_by: string | null
          id: string
          image_data: string
          signed_at: string
          signer_name: string
          signer_role: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_data: string
          signed_at?: string
          signer_name: string
          signer_role?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_data?: string
          signed_at?: string
          signer_name?: string
          signer_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          annual_rent: number | null
          broker_id: string | null
          building_id: string | null
          calendar_type: string
          contract_number: string
          contract_type: string
          created_at: string
          created_by: string | null
          deposit: number | null
          duration_text: string | null
          end_date: string | null
          fees: number | null
          file_path: string | null
          id: string
          notes: string | null
          owner_id: string | null
          payment_cycle: string | null
          payments_count: number | null
          previous_contract_id: string | null
          property_id: string | null
          renewal_status: string | null
          renewal_terms: string | null
          signed_date: string | null
          signed_place: string | null
          source: string
          special_terms: string | null
          start_date: string | null
          status: string
          tenant_id: string | null
          total_value: number | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          annual_rent?: number | null
          broker_id?: string | null
          building_id?: string | null
          calendar_type?: string
          contract_number: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          deposit?: number | null
          duration_text?: string | null
          end_date?: string | null
          fees?: number | null
          file_path?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          payment_cycle?: string | null
          payments_count?: number | null
          previous_contract_id?: string | null
          property_id?: string | null
          renewal_status?: string | null
          renewal_terms?: string | null
          signed_date?: string | null
          signed_place?: string | null
          source?: string
          special_terms?: string | null
          start_date?: string | null
          status?: string
          tenant_id?: string | null
          total_value?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          annual_rent?: number | null
          broker_id?: string | null
          building_id?: string | null
          calendar_type?: string
          contract_number?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          deposit?: number | null
          duration_text?: string | null
          end_date?: string | null
          fees?: number | null
          file_path?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          payment_cycle?: string | null
          payments_count?: number | null
          previous_contract_id?: string | null
          property_id?: string | null
          renewal_status?: string | null
          renewal_terms?: string | null
          signed_date?: string | null
          signed_place?: string | null
          source?: string
          special_terms?: string | null
          start_date?: string | null
          status?: string
          tenant_id?: string | null
          total_value?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_previous_contract_id_fkey"
            columns: ["previous_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          property_id: string | null
          subject_type: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          property_id?: string | null
          subject_type: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string | null
          subject_type?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          happened_at: string
          id: string
          next_follow_up: string | null
          opportunity_id: string | null
          outcome: string | null
          subject: string | null
        }
        Insert: {
          activity_type: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          happened_at?: string
          id?: string
          next_follow_up?: string | null
          opportunity_id?: string | null
          outcome?: string | null
          subject?: string | null
        }
        Update: {
          activity_type?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          happened_at?: string
          id?: string
          next_follow_up?: string | null
          opportunity_id?: string | null
          outcome?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          body: string | null
          created_at: string
          deleted_at: string | null
          id: string
          sender_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_threads: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_threads_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          city_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          city_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "districts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_activities: {
        Row: {
          activity_type: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          details: string | null
          employee_id: string
          id: string
          notes: string | null
          outcome: string | null
          related_contact_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          activity_type?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          outcome?: string | null
          related_contact_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          related_contact_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_activities_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_activities_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_activities_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      error_log: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          source: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          message: string
          source: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          source?: string
        }
        Relationships: []
      }
      group_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          body: string | null
          channel: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_pinned: boolean
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          paid_at: string
          payment_transaction_id: string | null
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          paid_at?: string
          payment_transaction_id?: string | null
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          paid_at?: string
          payment_transaction_id?: string | null
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          contact_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_requests: {
        Row: {
          admin_notes: string | null
          asking_price: string | null
          assigned_to: string | null
          attachments: Json
          city: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          district: string | null
          email: string | null
          full_name: string
          id: string
          map_url: string | null
          phone: string
          property_id: string | null
          property_type: string | null
          purpose: string
          rent_period: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          asking_price?: string | null
          assigned_to?: string | null
          attachments?: Json
          city?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          email?: string | null
          full_name: string
          id?: string
          map_url?: string | null
          phone: string
          property_id?: string | null
          property_type?: string | null
          purpose?: string
          rent_period?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          asking_price?: string | null
          assigned_to?: string | null
          attachments?: Json
          city?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          email?: string | null
          full_name?: string
          id?: string
          map_url?: string | null
          phone?: string
          property_id?: string | null
          property_type?: string | null
          purpose?: string
          rent_period?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      message_log: {
        Row: {
          body: string
          channel: string
          contract_id: string | null
          created_at: string
          failure_reason: string | null
          followup_id: string | null
          id: string
          idempotency_key: string | null
          payment_id: string | null
          provider_message_id: string | null
          recipient_name: string | null
          recipient_phone: string
          result: string
          sent_by: string | null
          sent_by_system: boolean
          task_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          contract_id?: string | null
          created_at?: string
          failure_reason?: string | null
          followup_id?: string | null
          id?: string
          idempotency_key?: string | null
          payment_id?: string | null
          provider_message_id?: string | null
          recipient_name?: string | null
          recipient_phone: string
          result?: string
          sent_by?: string | null
          sent_by_system?: boolean
          task_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          contract_id?: string | null
          created_at?: string
          failure_reason?: string | null
          followup_id?: string | null
          id?: string
          idempotency_key?: string | null
          payment_id?: string | null
          provider_message_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          result?: string
          sent_by?: string | null
          sent_by_system?: boolean
          task_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "reminder_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "contract_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          language: string
          name: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          close_probability: number
          close_reason: string | null
          contact_id: string | null
          contract_id: string | null
          created_at: string
          deal_type: string
          expected_value: number | null
          id: string
          listing_request_id: string | null
          next_follow_up: string | null
          reservation_id: string | null
          stage: string
          supply_request_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          close_probability?: number
          close_reason?: string | null
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string
          deal_type?: string
          expected_value?: number | null
          id?: string
          listing_request_id?: string | null
          next_follow_up?: string | null
          reservation_id?: string | null
          stage?: string
          supply_request_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          close_probability?: number
          close_reason?: string | null
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string
          deal_type?: string
          expected_value?: number | null
          id?: string
          listing_request_id?: string | null
          next_follow_up?: string | null
          reservation_id?: string | null
          stage?: string
          supply_request_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_listing_request_id_fkey"
            columns: ["listing_request_id"]
            isOneToOne: false
            referencedRelation: "listing_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_supply_request_id_fkey"
            columns: ["supply_request_id"]
            isOneToOne: false
            referencedRelation: "supply_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_properties: {
        Row: {
          id: string
          opportunity_id: string
          property_id: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          property_id: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_properties_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_stage_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_stage: string | null
          id: string
          opportunity_id: string
          to_stage: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          opportunity_id: string
          to_stage: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          opportunity_id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          attachment_path: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          method: string | null
          notes: string | null
          paid_at: string
          payment_id: string
          recorded_by: string | null
          reference: string | null
          reversed_of: string | null
        }
        Insert: {
          amount: number
          attachment_path?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          method?: string | null
          notes?: string | null
          paid_at?: string
          payment_id: string
          recorded_by?: string | null
          reference?: string | null
          reversed_of?: string | null
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          method?: string | null
          notes?: string | null
          paid_at?: string
          payment_id?: string
          recorded_by?: string | null
          reference?: string | null
          reversed_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "contract_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_reversed_of_fkey"
            columns: ["reversed_of"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_notes: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          job_title: string | null
          org: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_notify: boolean
        }
        Insert: {
          admin_notes?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          org?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_notify?: boolean
        }
        Update: {
          admin_notes?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          org?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_notify?: boolean
        }
        Relationships: []
      }
      properties: {
        Row: {
          building_id: string | null
          city: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          district: string | null
          id: string
          internal_notes: string | null
          is_featured: boolean
          is_visible: boolean
          latitude: number | null
          link_facebook: string | null
          link_instagram: string | null
          link_snapchat: string | null
          link_tiktok: string | null
          link_tour: string | null
          link_x: string | null
          link_youtube: string | null
          longitude: number | null
          map_url: string | null
          name: string
          needs_review: boolean
          owner_id: string | null
          price_text: string | null
          price_value: number | null
          property_type: string | null
          purpose: string
          rent_period: string | null
          sort_order: number
          status: string
          unit_id: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          building_id?: string | null
          city?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          district?: string | null
          id?: string
          internal_notes?: string | null
          is_featured?: boolean
          is_visible?: boolean
          latitude?: number | null
          link_facebook?: string | null
          link_instagram?: string | null
          link_snapchat?: string | null
          link_tiktok?: string | null
          link_tour?: string | null
          link_x?: string | null
          link_youtube?: string | null
          longitude?: number | null
          map_url?: string | null
          name: string
          needs_review?: boolean
          owner_id?: string | null
          price_text?: string | null
          price_value?: number | null
          property_type?: string | null
          purpose?: string
          rent_period?: string | null
          sort_order?: number
          status?: string
          unit_id?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          building_id?: string | null
          city?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          district?: string | null
          id?: string
          internal_notes?: string | null
          is_featured?: boolean
          is_visible?: boolean
          latitude?: number | null
          link_facebook?: string | null
          link_instagram?: string | null
          link_snapchat?: string | null
          link_tiktok?: string | null
          link_tour?: string | null
          link_x?: string | null
          link_youtube?: string | null
          longitude?: number | null
          map_url?: string | null
          name?: string
          needs_review?: boolean
          owner_id?: string | null
          price_text?: string | null
          price_value?: number | null
          property_type?: string | null
          purpose?: string
          rent_period?: string | null
          sort_order?: number
          status?: string
          unit_id?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      property_guarantees: {
        Row: {
          id: string
          name: string
          property_id: string
          sort_order: number
          years: number
        }
        Insert: {
          id?: string
          name: string
          property_id: string
          sort_order?: number
          years?: number
        }
        Update: {
          id?: string
          name?: string
          property_id?: string
          sort_order?: number
          years?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_guarantees_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          property_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          property_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          property_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      property_videos: {
        Row: {
          created_at: string
          id: string
          property_id: string
          sort_order: number
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          sort_order?: number
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          sort_order?: number
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminder_followups: {
        Row: {
          contract_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_sent_at: string | null
          message_body: string
          next_send_at: string | null
          payment_id: string | null
          recipient_contact_id: string | null
          recipient_name: string | null
          recipient_phone: string
          repeat_interval: string
          sent_count: number
          status: string
          template_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_sent_at?: string | null
          message_body: string
          next_send_at?: string | null
          payment_id?: string | null
          recipient_contact_id?: string | null
          recipient_name?: string | null
          recipient_phone: string
          repeat_interval?: string
          sent_count?: number
          status?: string
          template_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_sent_at?: string | null
          message_body?: string
          next_send_at?: string | null
          payment_id?: string | null
          recipient_contact_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          repeat_interval?: string
          sent_count?: number
          status?: string
          template_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_followups_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_followups_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "contract_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_followups_recipient_contact_id_fkey"
            columns: ["recipient_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_followups_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_followups_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          request_id: string
          request_type: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          request_id: string
          request_type: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          request_id?: string
          request_type?: string
          to_status?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          contact_id: string | null
          contract_id: string | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          ends_at: string
          extended_count: number
          id: string
          notes: string | null
          property_id: string | null
          starts_at: string
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          contact_id?: string | null
          contract_id?: string | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          ends_at: string
          extended_count?: number
          id?: string
          notes?: string | null
          property_id?: string | null
          starts_at?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          contact_id?: string | null
          contract_id?: string | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          ends_at?: string
          extended_count?: number
          id?: string
          notes?: string | null
          property_id?: string | null
          starts_at?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_guarantees: {
        Row: {
          created_at: string
          default_years: number
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_years?: number
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_years?: number
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_kill_switch: {
        Row: {
          id: number
          locked: boolean
          message: string
          updated_at: string
        }
        Insert: {
          id?: number
          locked?: boolean
          message?: string
          updated_at?: string
        }
        Update: {
          id?: number
          locked?: boolean
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      supply_requests: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          broker_name: string | null
          broker_phone: string | null
          budget_max: number | null
          budget_min: number | null
          city: string | null
          contact_id: string | null
          created_at: string
          districts: string | null
          full_name: string
          id: string
          phone: string
          property_type: string | null
          request_type: string
          requester_notes: string | null
          requester_type: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          broker_name?: string | null
          broker_phone?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          contact_id?: string | null
          created_at?: string
          districts?: string | null
          full_name: string
          id?: string
          phone: string
          property_type?: string | null
          request_type?: string
          requester_notes?: string | null
          requester_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          broker_name?: string | null
          broker_phone?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          contact_id?: string | null
          created_at?: string
          districts?: string | null
          full_name?: string
          id?: string
          phone?: string
          property_type?: string | null
          request_type?: string
          requester_notes?: string | null
          requester_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          id: string
          subtask_note: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subtask_note?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subtask_note?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string
          id: string
          kind: string
          review_status: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path: string
          id?: string
          kind?: string
          review_status?: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string
          id?: string
          kind?: string
          review_status?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reminder_state: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_sent_at: string | null
          next_send_at: string
          sent_count: number
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_sent_at?: string | null
          next_send_at?: string
          sent_count?: number
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_sent_at?: string | null
          next_send_at?: string
          sent_count?: number
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reminder_state_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reminder_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_by: string | null
          contact_id: string | null
          contract_id: string | null
          created_at: string
          details: string | null
          due_date: string | null
          due_time: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_text: string | null
          priority: string
          property_id: string | null
          rejection_note: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_by?: string | null
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string
          details?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          priority?: string
          property_id?: string | null
          rejection_note?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_by?: string | null
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string
          details?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          priority?: string
          property_id?: string | null
          rejection_note?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          area: number | null
          building_id: string | null
          created_at: string
          floor: string | null
          id: string
          is_rentable: boolean
          notes: string | null
          owner_id: string | null
          rooms: number | null
          status: string
          unit_number: string
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          area?: number | null
          building_id?: string | null
          created_at?: string
          floor?: string | null
          id?: string
          is_rentable?: boolean
          notes?: string | null
          owner_id?: string | null
          rooms?: number | null
          status?: string
          unit_number: string
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          area?: number | null
          building_id?: string | null
          created_at?: string
          floor?: string | null
          id?: string
          is_rentable?: boolean
          notes?: string | null
          owner_id?: string | null
          rooms?: number | null
          status?: string
          unit_number?: string
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          action: string
          created_at: string
          id: string
          module: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_automation_lease: {
        Args: { _job_name: string; _lease_seconds?: number }
        Returns: boolean
      }
      bootstrap_current_user: { Args: never; Returns: undefined }
      can_view_activity: {
        Args: { _activity_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_reservation: {
        Args: { _reservation_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          contact_id: string | null
          contract_id: string | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          ends_at: string
          extended_count: number
          id: string
          notes: string | null
          property_id: string | null
          starts_at: string
          status: string
          unit_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_reservation_to_contract: {
        Args: { _reservation_id: string }
        Returns: string
      }
      create_reservation: {
        Args: {
          _contact_id?: string
          _duration_hours?: number
          _employee_id: string
          _notes?: string
          _property_id: string
        }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          contact_id: string | null
          contract_id: string | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          ends_at: string
          extended_count: number
          id: string
          notes: string | null
          property_id: string | null
          starts_at: string
          status: string
          unit_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_reservations: { Args: never; Returns: number }
      extend_reservation: {
        Args: { _reservation_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          contact_id: string | null
          contract_id: string | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          ends_at: string
          extended_count: number
          id: string
          notes: string | null
          property_id: string | null
          starts_at: string
          status: string
          unit_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_automation_lease: {
        Args: { _error?: string; _job_name: string }
        Returns: undefined
      }
      get_public_properties: {
        Args: { _code?: string; _limit?: number; _purpose?: string }
        Returns: Json
      }
      get_public_settings: { Args: never; Returns: Json }
      has_perm: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_task_member: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      user_org: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "employee" | "owner"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["super_admin", "employee", "owner"],
    },
  },
} as const
