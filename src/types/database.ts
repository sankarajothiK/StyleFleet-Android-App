/**
 * Supabase Database Types
 * Generated and validated according to DATABASE_SETUP.md
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shops: {
        Row: {
          id: string;
          name: string;
          owner_profile_id: string | null;
          logo_path: string | null;
          address: string | null;
          city: string | null;
          pin_code: string | null;
          gstin: string | null;
          phone: string | null;
          accent_color: string;
          invoice_prefix: string;
          gst_rate: number;
          invoice_numbering_mode?: string | null;
          social_links?: Record<string, string> | null;
          upi_id?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_profile_id?: string | null;
          logo_path?: string | null;
          address?: string | null;
          city?: string | null;
          pin_code?: string | null;
          gstin?: string | null;
          phone?: string | null;
          accent_color?: string;
          invoice_prefix?: string;
          gst_rate?: number;
          invoice_numbering_mode?: string | null;
          social_links?: Record<string, string> | null;
          upi_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_profile_id?: string | null;
          logo_path?: string | null;
          address?: string | null;
          city?: string | null;
          pin_code?: string | null;
          gstin?: string | null;
          phone?: string | null;
          accent_color?: string;
          invoice_prefix?: string;
          gst_rate?: number;
          invoice_numbering_mode?: string | null;
          social_links?: Record<string, string> | null;
          upi_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_members: {
        Row: {
          id: string;
          shop_id: string;
          profile_id: string;
          role: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          profile_id: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          profile_id?: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      staff: {
        Row: {
          id: string;
          shop_id: string;
          profile_id: string | null;
          name: string;
          role: string;
          phone: string | null;
          is_active: boolean;
          rating?: string | null;
          target_amount_minor: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          profile_id?: string | null;
          name: string;
          role?: string;
          phone?: string | null;
          is_active?: boolean;
          rating?: string | null;
          target_amount_minor?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          profile_id?: string | null;
          name?: string;
          role?: string;
          phone?: string | null;
          is_active?: boolean;
          rating?: string | null;
          target_amount_minor?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string;
          notes: string | null;
          preferred_staff_id: string | null;
          is_starred: boolean;
          is_active?: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          phone: string;
          notes?: string | null;
          preferred_staff_id?: string | null;
          is_starred?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          phone?: string;
          notes?: string | null;
          preferred_staff_id?: string | null;
          is_starred?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      service_categories: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          shop_id: string;
          category_id: string | null;
          name: string;
          price_minor: number;
          duration_minutes: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          category_id?: string | null;
          name: string;
          price_minor: number;
          duration_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          category_id?: string | null;
          name?: string;
          price_minor?: number;
          duration_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      offers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          description: string | null;
          discount_type: string;
          discount_value: number;
          conditions: Json;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          description?: string | null;
          discount_type?: string;
          discount_value?: number;
          conditions?: Json;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          description?: string | null;
          discount_type?: string;
          discount_value?: number;
          conditions?: Json;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string | null;
          staff_id: string | null;
          service_id: string | null;
          starts_at: string;
          duration_minutes: number;
          status: string;
          notes: string | null;
          confirmation_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id?: string | null;
          staff_id?: string | null;
          service_id?: string | null;
          starts_at: string;
          duration_minutes?: number;
          status?: string;
          notes?: string | null;
          confirmation_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string | null;
          staff_id?: string | null;
          service_id?: string | null;
          starts_at?: string;
          duration_minutes?: number;
          status?: string;
          notes?: string | null;
          confirmation_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      bills: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string | null;
          staff_id: string | null;
          invoice_number: string;
          status: string;
          subtotal_minor: number;
          discount_minor: number;
          tax_minor: number;
          tip_minor?: number;
          total_minor: number;
          notes: string | null;
          reminder_status?: string | null;
          confirmation_status?: string | null;
          issued_at: string;
          created_by: string | null;
          pdf_url?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id?: string | null;
          staff_id?: string | null;
          invoice_number: string;
          status?: string;
          subtotal_minor?: number;
          discount_minor?: number;
          tax_minor?: number;
          tip_minor?: number;
          total_minor?: number;
          notes?: string | null;
          reminder_status?: string | null;
          confirmation_status?: string | null;
          issued_at?: string;
          created_by?: string | null;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string | null;
          staff_id?: string | null;
          invoice_number?: string;
          status?: string;
          subtotal_minor?: number;
          discount_minor?: number;
          tax_minor?: number;
          tip_minor?: number;
          total_minor?: number;
          notes?: string | null;
          reminder_status?: string | null;
          confirmation_status?: string | null;
          issued_at?: string;
          created_by?: string | null;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      bill_items: {
        Row: {
          id: string;
          bill_id: string;
          service_id: string | null;
          service_name_snapshot: string;
          quantity: number;
          unit_price_minor: number;
          discount_minor: number;
          tax_minor: number;
          line_total_minor: number;
          staff_id: string | null;
        };
        Insert: {
          id?: string;
          bill_id: string;
          service_id?: string | null;
          service_name_snapshot: string;
          quantity?: number;
          unit_price_minor: number;
          discount_minor?: number;
          tax_minor?: number;
          line_total_minor: number;
          staff_id?: string | null;
        };
        Update: {
          id?: string;
          bill_id?: string;
          service_id?: string | null;
          service_name_snapshot?: string;
          quantity?: number;
          unit_price_minor?: number;
          discount_minor?: number;
          tax_minor?: number;
          line_total_minor?: number;
          staff_id?: string | null;
        };
      };
      payments: {
        Row: {
          id: string;
          shop_id: string;
          bill_id: string;
          amount_minor: number;
          method: string;
          status: string;
          reference: string | null;
          paid_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          bill_id: string;
          amount_minor: number;
          method?: string;
          status?: string;
          reference?: string | null;
          paid_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          bill_id?: string;
          amount_minor?: number;
          method?: string;
          status?: string;
          reference?: string | null;
          paid_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      expense_categories: {
        Row: {
          id: string;
          shop_id: string | null;
          name: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          name: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          name?: string;
          is_active?: boolean;
        };
      };
      expenses: {
        Row: {
          id: string;
          shop_id: string;
          category_id: string | null;
          note: string;
          amount_minor: number;
          payment_method: string;
          expense_date: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          category_id?: string | null;
          note: string;
          amount_minor: number;
          payment_method?: string;
          expense_date?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          category_id?: string | null;
          note?: string;
          amount_minor?: number;
          payment_method?: string;
          expense_date?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_settings: {
        Row: {
          shop_id: string;
          appointment_reminder_enabled: boolean;
          payment_followup_enabled: boolean;
          daily_closing_enabled: boolean;
          daily_closing_time: string;
          appointment_reminder_minutes: number;
          payment_followup_interval_days: number;
          updated_at: string;
        };
        Insert: {
          shop_id: string;
          appointment_reminder_enabled?: boolean;
          payment_followup_enabled?: boolean;
          daily_closing_enabled?: boolean;
          daily_closing_time?: string;
          appointment_reminder_minutes?: number;
          payment_followup_interval_days?: number;
          updated_at?: string;
        };
        Update: {
          shop_id?: string;
          appointment_reminder_enabled?: boolean;
          payment_followup_enabled?: boolean;
          daily_closing_enabled?: boolean;
          daily_closing_time?: string;
          appointment_reminder_minutes?: number;
          payment_followup_interval_days?: number;
          updated_at?: string;
        };
      };
      whatsapp_templates: {
        Row: {
          id: string;
          shop_id: string | null;
          name: string;
          body: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          name: string;
          body: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          name?: string;
          body?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      whatsapp_campaigns: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          audience_type: string;
          template_id: string | null;
          message_body: string;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          audience_type: string;
          template_id?: string | null;
          message_body: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          audience_type?: string;
          template_id?: string | null;
          message_body?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      whatsapp_messages: {
        Row: {
          id: string;
          shop_id: string;
          campaign_id: string | null;
          customer_id: string | null;
          phone: string;
          body: string;
          provider_message_id: string | null;
          status: string;
          sent_at: string;
          delivered_at: string | null;
          failed_at: string | null;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          campaign_id?: string | null;
          customer_id?: string | null;
          phone: string;
          body: string;
          provider_message_id?: string | null;
          status?: string;
          sent_at?: string;
          delivered_at?: string | null;
          failed_at?: string | null;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          campaign_id?: string | null;
          customer_id?: string | null;
          phone?: string;
          body?: string;
          provider_message_id?: string | null;
          status?: string;
          sent_at?: string;
          delivered_at?: string | null;
          failed_at?: string | null;
          error_message?: string | null;
        };
      };
      reminder_rules: {
        Row: {
          id: string;
          shop_id: string;
          type: string;
          is_enabled: boolean;
          configuration: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          type: string;
          is_enabled?: boolean;
          configuration?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          type?: string;
          is_enabled?: boolean;
          configuration?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          shop_id: string;
          actor_profile_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          actor_profile_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          actor_profile_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          metadata?: Json;
        };
      };
      telemetry: {
        Row: {
          id: string;
          shop_id: string | null;
          device_id: string;
          device_name: string | null;
          platform: string;
          os_name: string | null;
          os_version: string | null;
          app_version: string | null;
          battery_level: number | null;
          is_charging: boolean | null;
          network_type: string | null;
          screen_resolution: string | null;
          memory_usage: Json;
          metadata: Json;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          device_id: string;
          device_name?: string | null;
          platform: string;
          os_name?: string | null;
          os_version?: string | null;
          app_version?: string | null;
          battery_level?: number | null;
          is_charging?: boolean | null;
          network_type?: string | null;
          screen_resolution?: string | null;
          memory_usage?: Json;
          metadata?: Json;
          recorded_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          device_id?: string;
          device_name?: string | null;
          platform?: string;
          os_name?: string | null;
          os_version?: string | null;
          app_version?: string | null;
          battery_level?: number | null;
          is_charging?: boolean | null;
          network_type?: string | null;
          screen_resolution?: string | null;
          memory_usage?: Json;
          metadata?: Json;
          recorded_at?: string;
          created_at?: string;
        };
      };
      system_health: {
        Row: {
          id: string;
          shop_id: string | null;
          component: string;
          status: string;
          latency_ms: number | null;
          error_count: number;
          details: Json;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          component: string;
          status?: string;
          latency_ms?: number | null;
          error_count?: number;
          details?: Json;
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          component?: string;
          status?: string;
          latency_ms?: number | null;
          error_count?: number;
          details?: Json;
          timestamp?: string;
          created_at?: string;
        };
      };
      system_logs: {
        Row: {
          id: string;
          shop_id: string | null;
          level: string;
          tag: string;
          message: string;
          stack_trace: string | null;
          device_id: string | null;
          device_info: Json;
          context: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          level?: string;
          tag: string;
          message: string;
          stack_trace?: string | null;
          device_id?: string | null;
          device_info?: Json;
          context?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          level?: string;
          tag?: string;
          message?: string;
          stack_trace?: string | null;
          device_id?: string | null;
          device_info?: Json;
          context?: Json;
          created_at?: string;
        };
      };
      app_version_config: {
        Row: {
          id: string;
          min_required_version: string;
          latest_version: string;
          is_mandatory: boolean;
          release_notes: string | null;
          play_store_url: string;
          app_store_url: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          min_required_version?: string;
          latest_version?: string;
          is_mandatory?: boolean;
          release_notes?: string | null;
          play_store_url?: string;
          app_store_url?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          min_required_version?: string;
          latest_version?: string;
          is_mandatory?: boolean;
          release_notes?: string | null;
          play_store_url?: string;
          app_store_url?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_shop_member: {
        Args: {
          target_shop_id: string;
        };
        Returns: boolean;
      };
      initialize_shop_defaults: {
        Args: {
          new_shop_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
