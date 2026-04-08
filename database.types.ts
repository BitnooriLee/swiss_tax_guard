/**
 * Minimal Supabase schema stub until `npm run db:typegen` is configured.
 * Extend with generated types for stricter queries.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          profile_id: string;
          name: string;
          avatar_url: string | null;
          residence_canton: string;
          marketing_consent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          name: string;
          avatar_url?: string | null;
          residence_canton?: string;
          marketing_consent?: boolean;
        };
        Update: {
          name?: string;
          avatar_url?: string | null;
          residence_canton?: string;
          marketing_consent?: boolean;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          payment_id: number;
          payment_key: string;
          order_id: string;
          order_name: string;
          total_amount: number;
          metadata: Json;
          raw_data: Json;
          receipt_url: string;
          status: string;
          user_id: string | null;
          approved_at: string;
          requested_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          payment_key: string;
          order_id: string;
          order_name: string;
          total_amount: number;
          metadata: Json;
          raw_data: Json;
          receipt_url: string;
          status: string;
          approved_at: string;
          requested_at: string;
          user_id: string;
        };
        Update: Partial<{
          payment_key: string;
          order_id: string;
          order_name: string;
          total_amount: number;
          metadata: Json;
          raw_data: Json;
          receipt_url: string;
          status: string;
          approved_at: string;
          requested_at: string;
          user_id: string | null;
        }>;
        Relationships: [];
      };
      asset_ledger: {
        Row: {
          id: string;
          user_id: string;
          asset_type: string;
          action_type: string;
          description: string | null;
          amount: string;
          external_api_id: string | null;
          currency: string;
          original_currency: string;
          original_amount: string;
          fx_rate: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      swiss_tax_contexts: {
        Row: {
          profile_id: string;
          canton: string;
          municipality_id: string;
          marital_status: string;
          church_tax: boolean;
          children_count: number;
          moved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          canton: string;
          municipality_id?: string;
          marital_status: string;
          church_tax?: boolean;
          children_count?: number;
          moved_at?: string | null;
        };
        Update: Partial<{
          canton: string;
          municipality_id: string;
          marital_status: string;
          church_tax: boolean;
          children_count: number;
          moved_at: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
