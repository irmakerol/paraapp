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
          notification_prefs: Json;
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
          notification_prefs?: Json;
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

      news: {
        Row: {
          id: string;
          slug: string;
          locale: string;
          title: string;
          summary: string | null;
          body_md: string;
          cover_path: string | null;
          tags: string[];
          members_only: boolean;
          pinned: boolean;
          comments_enabled: boolean;
          notify_on_publish: boolean;
          notified_at: Timestamp | null;
          status: Database['public']['Enums']['publish_status'];
          published_at: Timestamp | null;
          author_id: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          slug: string;
          locale?: string;
          title: string;
          summary?: string | null;
          body_md?: string;
          cover_path?: string | null;
          tags?: string[];
          members_only?: boolean;
          pinned?: boolean;
          comments_enabled?: boolean;
          notify_on_publish?: boolean;
          notified_at?: Timestamp | null;
          status?: Database['public']['Enums']['publish_status'];
          published_at?: Timestamp | null;
          author_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['news']['Insert']>;
        Relationships: [];
      };
      news_comments: {
        Row: {
          id: string;
          news_id: string;
          author_id: string;
          body: string;
          hidden_at: Timestamp | null;
          hidden_by: string | null;
          created_at: Timestamp;
        };
        Insert: { news_id: string; author_id: string; body: string };
        Update: { hidden_at?: Timestamp | null; hidden_by?: string | null };
        Relationships: [];
      };
      news_likes: {
        Row: { news_id: string; user_id: string; created_at: Timestamp };
        Insert: { news_id: string; user_id: string };
        Update: never;
        Relationships: [];
      };
      tips: {
        Row: {
          id: string;
          slug: string;
          locale: string;
          title: string;
          summary: string | null;
          body_md: string;
          category: Database['public']['Enums']['tip_category'];
          difficulty: Database['public']['Enums']['difficulty'];
          video_url: string | null;
          status: Database['public']['Enums']['tip_status'];
          published_at: Timestamp | null;
          review_note: string | null;
          author_id: string | null;
          reviewed_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          slug: string;
          locale?: string;
          title: string;
          summary?: string | null;
          body_md?: string;
          category: Database['public']['Enums']['tip_category'];
          difficulty?: Database['public']['Enums']['difficulty'];
          video_url?: string | null;
          status?: Database['public']['Enums']['tip_status'];
          published_at?: Timestamp | null;
          review_note?: string | null;
          author_id?: string | null;
          reviewed_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tips']['Insert']>;
        Relationships: [];
      };
      tip_bookmarks: {
        Row: { user_id: string; tip_id: string; created_at: Timestamp };
        Insert: { user_id: string; tip_id: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'tip_bookmarks_tip_id_fkey';
            columns: ['tip_id'];
            isOneToOne: false;
            referencedRelation: 'tips';
            referencedColumns: ['id'];
          },
        ];
      };
      ads: {
        Row: {
          id: string;
          owner_id: string;
          is_club: boolean;
          title: string;
          category: Database['public']['Enums']['ad_category'];
          brand: string | null;
          model: string | null;
          size: string | null;
          weight_min: number | null;
          weight_max: number | null;
          year: number | null;
          hours: number | null;
          flights: number | null;
          certification: string | null;
          last_check_date: string | null;
          reserve_repack_date: string | null;
          condition: Database['public']['Enums']['ad_condition'];
          price: number;
          currency: Database['public']['Enums']['currency'];
          city: string | null;
          location_text: string | null;
          description: string;
          status: Database['public']['Enums']['ad_status'];
          expires_at: Timestamp;
          renewal_reminded_at: Timestamp | null;
          removed_at: Timestamp | null;
          removed_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          owner_id: string;
          is_club?: boolean;
          title: string;
          category: Database['public']['Enums']['ad_category'];
          brand?: string | null;
          model?: string | null;
          size?: string | null;
          weight_min?: number | null;
          weight_max?: number | null;
          year?: number | null;
          hours?: number | null;
          flights?: number | null;
          certification?: string | null;
          last_check_date?: string | null;
          reserve_repack_date?: string | null;
          condition: Database['public']['Enums']['ad_condition'];
          price: number;
          currency?: Database['public']['Enums']['currency'];
          city?: string | null;
          location_text?: string | null;
          description?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['ads']['Insert'], 'owner_id'>> & {
          status?: Database['public']['Enums']['ad_status'];
          removed_at?: Timestamp | null;
          removed_by?: string | null;
        };
        Relationships: [];
      };
      ad_photos: {
        Row: { id: string; ad_id: string; path: string; position: number; created_at: Timestamp };
        Insert: { ad_id: string; path: string; position: number };
        Update: { position?: number };
        Relationships: [
          {
            foreignKeyName: 'ad_photos_ad_id_fkey';
            columns: ['ad_id'];
            isOneToOne: false;
            referencedRelation: 'ads';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: number;
          user_id: string;
          kind: string;
          payload: Json;
          read_at: Timestamp | null;
          pushed_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: never;
        // pushed_at is only written with the service role.
        Update: { read_at?: Timestamp | null; pushed_at?: Timestamp | null };
        Relationships: [];
      };
      blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: Timestamp };
        Insert: { blocker_id: string; blocked_id: string };
        Update: never;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          target_type: Database['public']['Enums']['report_target'];
          target_id: string;
          reason: Database['public']['Enums']['report_reason'];
          details: string | null;
          status: Database['public']['Enums']['report_status'];
          resolution_note: string | null;
          handled_by: string | null;
          handled_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          reporter_id: string;
          target_type: Database['public']['Enums']['report_target'];
          target_id: string;
          reason: Database['public']['Enums']['report_reason'];
          details?: string | null;
        };
        Update: {
          status?: Database['public']['Enums']['report_status'];
          resolution_note?: string | null;
          handled_by?: string | null;
          handled_at?: Timestamp | null;
        };
        Relationships: [];
      };
      chats: {
        Row: {
          id: string;
          kind: Database['public']['Enums']['chat_kind'];
          title: string | null;
          ad_id: string | null;
          created_by: string | null;
          last_message_at: Timestamp;
          created_at: Timestamp;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      chat_members: {
        Row: {
          chat_id: string;
          user_id: string;
          joined_at: Timestamp;
          last_read_at: Timestamp | null;
          muted: boolean;
        };
        Insert: never;
        Update: { last_read_at?: Timestamp | null; muted?: boolean };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          sender_id: string | null;
          body: string | null;
          image_path: string | null;
          lat: number | null;
          lng: number | null;
          deleted_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          chat_id: string;
          sender_id: string;
          body?: string | null;
          image_path?: string | null;
          lat?: number | null;
          lng?: number | null;
        };
        Update: { deleted_at?: Timestamp | null };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: Timestamp;
        };
        Insert: { user_id: string; endpoint: string; p256dh: string; auth: string; user_agent?: string | null };
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
      renew_ad: { Args: { p_ad: string }; Returns: Timestamp };
      start_direct_chat: { Args: { p_other: string; p_ad?: string | null }; Returns: string };
      reported_chat_messages: {
        Args: { p_report: string };
        Returns: Database['public']['Tables']['messages']['Row'][];
      };
      ban_user: { Args: { p_user: string; p_until: Timestamp | null; p_reason: string }; Returns: undefined };
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
      publish_status: 'draft' | 'published';
      tip_category:
        | 'launching'
        | 'landing'
        | 'thermalling'
        | 'xc'
        | 'weather'
        | 'siv_safety'
        | 'equipment_care'
        | 'reserve_repacking'
        | 'beginner_faq';
      difficulty: 'beginner' | 'intermediate' | 'advanced';
      tip_status: 'draft' | 'pending_review' | 'published' | 'rejected';
      ad_category:
        | 'wing'
        | 'harness'
        | 'reserve'
        | 'instrument'
        | 'helmet'
        | 'radio'
        | 'clothing'
        | 'accessories'
        | 'other';
      ad_condition: 'new' | 'like_new' | 'good' | 'fair' | 'for_parts';
      ad_status: 'active' | 'reserved' | 'sold' | 'archived';
      currency: 'TRY' | 'EUR' | 'USD';
      report_target: 'ad' | 'user' | 'chat' | 'message' | 'news_comment' | 'tip';
      report_reason: 'spam' | 'scam' | 'harassment' | 'hate' | 'sexual' | 'dangerous' | 'illegal' | 'other';
      report_status: 'open' | 'actioned' | 'dismissed';
      chat_kind: 'direct' | 'group';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
