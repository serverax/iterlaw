/**
 * IterLaw — Supabase Postgres types (Phase 0 Step 3).
 *
 * Regenerate from your hosted project when linked to Supabase CLI:
 *   npx supabase gen types typescript --project-id jjzckatjcxrwmcpuaavl > types/schema.ts
 *
 * This file is hand-maintained to match `migrations/*.sql` until CI runs codegen.
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
      users: {
        Row: {
          id: string;
          email: string | null;
          oauth_provider: string;
          oauth_id: string;
          subscription_tier: string;
          subscription_active_until: string | null;
          jurisdiction: string;
          loyalty_points: number;
          loyalty_tier: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          oauth_provider: string;
          oauth_id: string;
          subscription_tier?: string;
          subscription_active_until?: string | null;
          jurisdiction?: string;
          loyalty_points?: number;
          loyalty_tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          oauth_provider?: string;
          oauth_id?: string;
          subscription_tier?: string;
          subscription_active_until?: string | null;
          jurisdiction?: string;
          loyalty_points?: number;
          loyalty_tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cases: {
        Row: {
          id: string;
          user_id: string;
          situation_type: string;
          employment_start_date: string | null;
          service_category: string | null;
          case_stage: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          resolved_date: string | null;
          notes: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          situation_type: string;
          employment_start_date?: string | null;
          service_category?: string | null;
          case_stage?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          resolved_date?: string | null;
          notes?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          situation_type?: string;
          employment_start_date?: string | null;
          service_category?: string | null;
          case_stage?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          resolved_date?: string | null;
          notes?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cases_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      case_timeline_entries: {
        Row: {
          id: string;
          case_id: string;
          event_date: string;
          event_type: string;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          event_date: string;
          event_type: string;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          event_date?: string;
          event_type?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'case_timeline_entries_case_id_fkey';
            columns: ['case_id'];
            referencedRelation: 'cases';
            referencedColumns: ['id'];
          },
        ];
      };
      questions: {
        Row: {
          id: string;
          case_id: string | null;
          user_id: string;
          question_text: string;
          /** pgvector(1536); wire format from PostgREST is often a string literal */
          question_embedding: string;
          jurisdiction: string;
          situation_type: string;
          answer_law_section: string | null;
          answer_meaning: string | null;
          answer_action: string | null;
          source_citation: string;
          source_url: string | null;
          source_type: string;
          confidence_score: number;
          legal_reviewer_approved: boolean;
          legislation_version: string | null;
          expires_at: string;
          is_active: boolean;
          hit_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id?: string | null;
          user_id: string;
          question_text: string;
          question_embedding: string;
          jurisdiction: string;
          situation_type: string;
          answer_law_section?: string | null;
          answer_meaning?: string | null;
          answer_action?: string | null;
          source_citation: string;
          source_url?: string | null;
          source_type: string;
          confidence_score: number;
          legal_reviewer_approved?: boolean;
          legislation_version?: string | null;
          expires_at: string;
          is_active?: boolean;
          hit_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string | null;
          user_id?: string;
          question_text?: string;
          question_embedding?: string;
          jurisdiction?: string;
          situation_type?: string;
          answer_law_section?: string | null;
          answer_meaning?: string | null;
          answer_action?: string | null;
          source_citation?: string;
          source_url?: string | null;
          source_type?: string;
          confidence_score?: number;
          legal_reviewer_approved?: boolean;
          legislation_version?: string | null;
          expires_at?: string;
          is_active?: boolean;
          hit_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'questions_case_id_fkey';
            columns: ['case_id'];
            referencedRelation: 'cases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'questions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          case_id: string | null;
          user_id: string;
          document_type: string;
          extracted_text: string | null;
          analysis_result: Json | null;
          upload_timestamp: string;
          image_deletion_scheduled_for: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id?: string | null;
          user_id: string;
          document_type: string;
          extracted_text?: string | null;
          analysis_result?: Json | null;
          upload_timestamp?: string;
          image_deletion_scheduled_for?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string | null;
          user_id?: string;
          document_type?: string;
          extracted_text?: string | null;
          analysis_result?: Json | null;
          upload_timestamp?: string;
          image_deletion_scheduled_for?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_case_id_fkey';
            columns: ['case_id'];
            referencedRelation: 'cases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      solicitor_partners: {
        Row: {
          id: string;
          firm_name: string;
          contact_email: string;
          contact_phone: string | null;
          jurisdiction_coverage: string[];
          referral_fee: number | null;
          referral_api_key: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firm_name: string;
          contact_email: string;
          contact_phone?: string | null;
          jurisdiction_coverage: string[];
          referral_fee?: number | null;
          referral_api_key?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          firm_name?: string;
          contact_email?: string;
          contact_phone?: string | null;
          jurisdiction_coverage?: string[];
          referral_fee?: number | null;
          referral_api_key?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      solicitor_referrals: {
        Row: {
          id: string;
          case_id: string;
          user_id: string;
          reason: string;
          case_summary_pdf_url: string | null;
          referred_to_solicitor_id: string | null;
          status: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          user_id: string;
          reason: string;
          case_summary_pdf_url?: string | null;
          referred_to_solicitor_id?: string | null;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          case_id?: string;
          user_id?: string;
          reason?: string;
          case_summary_pdf_url?: string | null;
          referred_to_solicitor_id?: string | null;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'solicitor_referrals_case_id_fkey';
            columns: ['case_id'];
            referencedRelation: 'cases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'solicitor_referrals_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'solicitor_referrals_referred_to_solicitor_id_fkey';
            columns: ['referred_to_solicitor_id'];
            referencedRelation: 'solicitor_partners';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      update_timestamp: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
