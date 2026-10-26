// Hand-written to match supabase/migrations until it can be generated.
// Regenerate with `pnpm db:types` (needs `pnpm db:start`), which overwrites this file.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;

export type Database = {
  public: {
    Tables: {
      user_roles: {
        Row: {
          user_id: string;
          role: Database['public']['Enums']['app_role'];
          granted_by: string | null;
          granted_at: Timestamp;
        };
        Insert: {
          user_id: string;
          role: Database['public']['Enums']['app_role'];
          granted_by?: string | null;
          granted_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_table: string | null;
          target_id: string | null;
          details: Json;
          created_at: Timestamp;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          full_name: string | null;
          avatar_path: string | null;
          country: string | null;
          city: string | null;
          home_site: string | null;
          pilot_level: Database['public']['Enums']['pilot_level'] | null;
          years_flying: number | null;
          wings: string | null;
          bio: string | null;
          field_privacy: Json;
          locale: string;
          units: Json;
          age_group: Database['public']['Enums']['age_group'] | null;
          status: Database['public']['Enums']['account_status'];
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: never;
        Update: {
          display_name?: string;
          full_name?: string | null;
          avatar_path?: string | null;
          country?: string | null;
          city?: string | null;
          home_site?: string | null;
          pilot_level?: Database['public']['Enums']['pilot_level'] | null;
          years_flying?: number | null;
          wings?: string | null;
          bio?: string | null;
          field_privacy?: Json;
          locale?: string;
          units?: Json;
        };
        Relationships: [];
      };
      profile_private: {
        Row: {
          user_id: string;
          birth_date: string | null;
          licence_number_enc: string | null;
          updated_at: Timestamp;
        };
        Insert: never;
        Update: { licence_number_enc?: string | null };
        Relationships: [];
      };
      legal_documents: {
        Row: {
          id: string;
          kind: Database['public']['Enums']['legal_document_kind'];
          locale: string;
          version: number;
          title: string;
          body_md: string;
          material: boolean;
          published_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          kind: Database['public']['Enums']['legal_document_kind'];
          locale: string;
          version: number;
          title: string;
          body_md: string;
          material?: boolean;
          published_at?: Timestamp | null;
        };
        Update: Partial<Database['public']['Tables']['legal_documents']['Insert']>;
        Relationships: [];
      };
      legal_acceptances: {
        Row: { user_id: string; document_id: string; accepted_at: Timestamp };
        Insert: { user_id: string; document_id: string; accepted_at?: Timestamp };
        Update: never;
        Relationships: [];
      };
      consents: {
        Row: {
          id: number;
          user_id: string;
          consent_type: Database['public']['Enums']['consent_type'];
          granted: boolean;
          document_id: string | null;
          method: 'signup' | 'settings' | 'feature_prompt';
          created_at: Timestamp;
        };
        Insert: {
          user_id: string;
          consent_type: Database['public']['Enums']['consent_type'];
          granted: boolean;
          document_id?: string | null;
          method: 'signup' | 'settings' | 'feature_prompt';
        };
        Update: never;
        Relationships: [];
      };
      data_requests: {
        Row: {
          id: string;
          user_id: string | null;
          requester_email: string;
          request_type: Database['public']['Enums']['data_request_type'];
          channel: 'in_app' | 'email' | 'post' | 'other';
          details: string | null;
          status: Database['public']['Enums']['data_request_status'];
          received_at: Timestamp;
          due_at: Timestamp;
          completed_at: Timestamp | null;
          handled_by: string | null;
          notes: string | null;
          updated_at: Timestamp;
        };
        Insert: {
          user_id?: string | null;
          requester_email: string;
          request_type: Database['public']['Enums']['data_request_type'];
          channel: 'in_app' | 'email' | 'post' | 'other';
          details?: string | null;
        };
        Update: {
          status?: Database['public']['Enums']['data_request_status'];
          completed_at?: Timestamp | null;
          handled_by?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      retention_policies: {
        Row: { data_type: string; retain_days: number | null; description: string; updated_at: Timestamp };
        Insert: never;
        Update: { retain_days?: number | null };
        Relationships: [];
      };
      guardian_consents: {
        Row: {
          id: string;
          user_id: string;
          guardian_name: string;
          guardian_email: string;
          created_at: Timestamp;
          expires_at: Timestamp;
          confirmed_at: Timestamp | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      account_deletions: {
        Row: {
          id: number;
          user_id: string;
          requested_at: Timestamp;
          purge_after: Timestamp;
          purged_at: Timestamp | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      current_consents: {
        Row: {
          user_id: string;
          consent_type: Database['public']['Enums']['consent_type'];
          granted: boolean;
          document_id: string | null;
          method: string;
          created_at: Timestamp;
        };
        Relationships: [];
      };
      profile_cards: {
        Row: {
          id: string;
          display_name: string | null;
          full_name: string | null;
          avatar_path: string | null;
          country: string | null;
          city: string | null;
          home_site: string | null;
          pilot_level: Database['public']['Enums']['pilot_level'] | null;
          years_flying: number | null;
          wings: string | null;
          bio: string | null;
          is_member: boolean;
          created_at: Timestamp;
        };
        Relationships: [];
      };
    };
    Functions: {
      pending_legal_kinds: {
        Args: Record<string, never>;
        Returns: Database['public']['Enums']['legal_document_kind'][];
      };
      complete_age_gate: {
        Args: { p_birth_date: string };
        Returns: Database['public']['Enums']['account_status'];
      };
      create_guardian_request: {
        Args: { p_user: string; p_name: string; p_email: string };
        Returns: string;
      };
      guardian_request_info: {
        Args: { p_token: string };
        Returns: {
          display_name: string;
          guardian_name: string;
          expires_at: Timestamp;
          confirmed: boolean;
        }[];
      };
      confirm_guardian_consent: { Args: { p_token: string }; Returns: boolean };
      request_account_deletion: { Args: Record<string, never>; Returns: Timestamp };
    };
    Enums: {
      app_role: 'pilot' | 'member' | 'instructor' | 'moderator' | 'safety_officer' | 'admin';
      visibility: 'public' | 'members' | 'private';
      account_status: 'onboarding' | 'pending_guardian' | 'active' | 'deletion_requested';
      age_group: 'minor' | 'adult';
      pilot_level: 'student' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'tandem' | 'instructor';
      legal_document_kind: 'privacy_notice' | 'terms' | 'explicit_consent';
      consent_type:
        | 'marketing_notifications'
        | 'analytics'
        | 'public_profile'
        | 'live_location'
        | 'incident_special_category';
      data_request_type:
        | 'access'
        | 'rectification'
        | 'erasure'
        | 'restriction'
        | 'portability'
        | 'objection'
        | 'withdraw_consent'
        | 'other';
      data_request_status: 'received' | 'in_progress' | 'completed' | 'rejected';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
