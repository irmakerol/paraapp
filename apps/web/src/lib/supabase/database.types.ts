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
          flying_since: number | null;
          weight_kg: number | null;
          total_flight_hours: number;
          total_flights: number;
          wings: string | null;
          bio: string | null;
          field_privacy: Json;
          locale: string;
          units: Json;
          notification_prefs: Json;
          age_group: Database['public']['Enums']['age_group'] | null;
          status: Database['public']['Enums']['account_status'];
          created_at: Timestamp;
          last_seen_at: Timestamp | null;
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
          flying_since?: number | null;
          weight_kg?: number | null;
          total_flight_hours?: number;
          total_flights?: number;
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
          licence_body: string | null;
          updated_at: Timestamp;
        };
        Insert: never;
        Update: { licence_number_enc?: string | null; licence_body?: string | null };
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

      active_flights: {
        Row: {
          user_id: string;
          started_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { user_id: string; started_at?: Timestamp; updated_at?: Timestamp };
        Update: { started_at?: Timestamp; updated_at?: Timestamp };
        Relationships: [];
      };
      user_activity: {
        Row: { id: number; user_id: string; kind: string; ref: string | null; created_at: Timestamp };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string | null;
          created_at: Timestamp;
        };
        Insert: { name: string; description?: string | null; created_by: string };
        Update: { name?: string; description?: string | null };
        Relationships: [];
      };
      user_group_members: {
        Row: { group_id: string; user_id: string; added_by: string | null; added_at: Timestamp };
        Insert: { group_id: string; user_id: string; added_by: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'user_group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'user_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      club_messages: {
        Row: {
          id: string;
          sender_id: string | null;
          audience: 'all' | 'role' | 'group';
          audience_role: Database['public']['Enums']['app_role'] | null;
          audience_group: string | null;
          audience_label: string | null;
          title: string;
          body: string;
          recipient_count: number;
          created_at: Timestamp;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      club_message_recipients: {
        Row: { message_id: string; user_id: string; read_at: Timestamp | null };
        Insert: never;
        Update: { read_at?: Timestamp | null };
        Relationships: [
          {
            foreignKeyName: 'club_message_recipients_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'club_messages';
            referencedColumns: ['id'];
          },
        ];
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
      sites: {
        Row: {
          id: string;
          slug: string;
          name: string;
          kind: Database['public']['Enums']['site_kind'];
          lat: number;
          lng: number;
          location: unknown;
          elevation_m: number | null;
          wind_directions: string[];
          region: string | null;
          country: string;
          description: string;
          rules: string;
          verified: boolean;
          created_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          slug: string;
          name: string;
          kind?: Database['public']['Enums']['site_kind'];
          lat: number;
          lng: number;
          elevation_m?: number | null;
          wind_directions?: string[];
          region?: string | null;
          country?: string;
          description?: string;
          rules?: string;
          verified?: boolean;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['sites']['Insert']>;
        Relationships: [];
      };
      equipment: {
        Row: {
          id: string;
          user_id: string;
          kind: Database['public']['Enums']['equipment_kind'];
          brand: string | null;
          model: string;
          size: string | null;
          certification: string | null;
          purchased_on: string | null;
          last_check_on: string | null;
          check_interval_months: number | null;
          last_repack_on: string | null;
          repack_interval_months: number | null;
          check_reminded_on: string | null;
          repack_reminded_on: string | null;
          retired: boolean;
          notes: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          user_id: string;
          kind: Database['public']['Enums']['equipment_kind'];
          brand?: string | null;
          model: string;
          size?: string | null;
          certification?: string | null;
          purchased_on?: string | null;
          last_check_on?: string | null;
          check_interval_months?: number | null;
          last_repack_on?: string | null;
          repack_interval_months?: number | null;
          retired?: boolean;
          notes?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['equipment']['Insert'], 'user_id'>>;
        Relationships: [];
      };
      flights: {
        Row: {
          counted_in_totals: boolean;
          id: string;
          user_id: string;
          started_at: Timestamp;
          duration_s: number;
          takeoff_site_id: string | null;
          landing_site_id: string | null;
          site_name: string | null;
          glider: string | null;
          wing_id: string | null;
          distance_m: number | null;
          straight_m: number | null;
          max_from_takeoff_m: number | null;
          takeoff_alt_m: number | null;
          landing_alt_m: number | null;
          max_alt_m: number | null;
          min_alt_m: number | null;
          max_climb_ms: number | null;
          max_sink_ms: number | null;
          visibility: Database['public']['Enums']['visibility'];
          notes: string | null;
          source: Database['public']['Enums']['flight_source'];
          file_path: string | null;
          file_sha256: string | null;
          public_track: Json | null;
          xc_distance_m: number | null;
          xc_points: number | null;
          xc_type: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        // Users may only insert manual flights; imports are written with the service role.
        Insert: {
          id?: string;
          user_id: string;
          started_at: Timestamp;
          duration_s: number;
          takeoff_site_id?: string | null;
          landing_site_id?: string | null;
          site_name?: string | null;
          glider?: string | null;
          wing_id?: string | null;
          distance_m?: number | null;
          straight_m?: number | null;
          max_from_takeoff_m?: number | null;
          takeoff_alt_m?: number | null;
          landing_alt_m?: number | null;
          max_alt_m?: number | null;
          min_alt_m?: number | null;
          max_climb_ms?: number | null;
          max_sink_ms?: number | null;
          visibility?: Database['public']['Enums']['visibility'];
          notes?: string | null;
          source: Database['public']['Enums']['flight_source'];
          file_path?: string | null;
          file_sha256?: string | null;
          public_track?: Json | null;
          xc_distance_m?: number | null;
          xc_points?: number | null;
          xc_type?: string | null;
        };
        Update: {
          takeoff_site_id?: string | null;
          landing_site_id?: string | null;
          site_name?: string | null;
          glider?: string | null;
          wing_id?: string | null;
          visibility?: Database['public']['Enums']['visibility'];
          notes?: string | null;
          // Service role only (no user grant).
          xc_type?: string | null;
          xc_distance_m?: number | null;
          xc_points?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'flights_takeoff_site_id_fkey';
            columns: ['takeoff_site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'flights_landing_site_id_fkey';
            columns: ['landing_site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'flights_wing_id_fkey';
            columns: ['wing_id'];
            isOneToOne: false;
            referencedRelation: 'equipment';
            referencedColumns: ['id'];
          },
        ];
      };
      flight_tracks: {
        Row: {
          flight_id: string;
          user_id: string;
          track: Json;
          takeoff_lat: number | null;
          takeoff_lng: number | null;
          landing_lat: number | null;
          landing_lng: number | null;
        };
        Insert: {
          flight_id: string;
          user_id: string;
          track: Json;
          takeoff_lat?: number | null;
          takeoff_lng?: number | null;
          landing_lat?: number | null;
          landing_lng?: number | null;
        };
        Update: never;
        Relationships: [];
      };
      follows: {
        Row: { follower_id: string; followee_id: string; created_at: Timestamp };
        Insert: { follower_id: string; followee_id: string };
        Update: never;
        Relationships: [];
      };
      incident_reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          anonymity: Database['public']['Enums']['incident_anonymity'];
          occurred_on: string;
          site_id: string | null;
          site_name: string | null;
          category: Database['public']['Enums']['incident_category'];
          severity: Database['public']['Enums']['incident_severity'];
          injured: boolean;
          description: string;
          conditions: string | null;
          equipment: string | null;
          lessons: string | null;
          contact_ok: boolean;
          special_category_consent: boolean;
          status: Database['public']['Enums']['incident_status'];
          assigned_to: string | null;
          closed_at: Timestamp | null;
          personal_data_purged_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        // Fully anonymous reports are inserted by the server with the service role.
        Insert: {
          reporter_id: string | null;
          anonymity: Database['public']['Enums']['incident_anonymity'];
          occurred_on: string;
          site_id?: string | null;
          site_name?: string | null;
          category: Database['public']['Enums']['incident_category'];
          severity: Database['public']['Enums']['incident_severity'];
          injured?: boolean;
          description: string;
          conditions?: string | null;
          equipment?: string | null;
          lessons?: string | null;
          contact_ok?: boolean;
          special_category_consent?: boolean;
        };
        Update: {
          status?: Database['public']['Enums']['incident_status'];
          assigned_to?: string | null;
          closed_at?: Timestamp | null;
        };
        Relationships: [
          {
            foreignKeyName: 'incident_reports_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      incident_notes: {
        Row: { id: string; incident_id: string; author_id: string | null; body: string; created_at: Timestamp };
        Insert: { incident_id: string; author_id: string; body: string };
        Update: never;
        Relationships: [];
      };
      /** No policies: only the service role and the audited functions touch it. */
      incident_injuries: {
        Row: { incident_id: string; details_enc: string };
        Insert: { incident_id: string; details_enc: string };
        Update: never;
        Relationships: [];
      };
      safety_lessons: {
        Row: {
          id: string;
          slug: string;
          locale: string;
          title: string;
          summary: string | null;
          body_md: string;
          category: Database['public']['Enums']['incident_category'];
          severity: Database['public']['Enums']['incident_severity'];
          status: Database['public']['Enums']['lesson_status'];
          author_id: string | null;
          published_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          slug: string;
          locale?: string;
          title: string;
          summary?: string | null;
          body_md: string;
          category: Database['public']['Enums']['incident_category'];
          severity: Database['public']['Enums']['incident_severity'];
          status?: Database['public']['Enums']['lesson_status'];
          author_id?: string | null;
          published_at?: Timestamp | null;
        };
        Update: {
          slug?: string;
          locale?: string;
          title?: string;
          summary?: string | null;
          body_md?: string;
          category?: Database['public']['Enums']['incident_category'];
          severity?: Database['public']['Enums']['incident_severity'];
          status?: Database['public']['Enums']['lesson_status'];
          published_at?: Timestamp | null;
        };
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          slug: string;
          title: string;
          summary: string | null;
          description_md: string;
          itinerary_md: string;
          cover_path: string | null;
          destination_country: string | null;
          destination_region: string | null;
          starts_on: string;
          ends_on: string;
          meeting_point: string | null;
          meeting_at: Timestamp | null;
          registration_opens_at: Timestamp | null;
          registration_deadline: Timestamp | null;
          max_pilots: number;
          min_pilots: number | null;
          companions_allowed: boolean;
          min_pilot_level: Database['public']['Enums']['pilot_level'] | null;
          min_years_flying: number | null;
          min_flights: number | null;
          required_equipment: string[];
          requirements_md: string;
          price_amount: number | null;
          price_currency: string;
          deposit_amount: number | null;
          payment_deadline: string | null;
          payment_info_md: string;
          price_includes: string | null;
          price_excludes: string | null;
          cancellation_policy: string | null;
          accommodation: string | null;
          transport: string | null;
          members_only: boolean;
          allow_minors: boolean;
          auto_accept: boolean;
          status: Database['public']['Enums']['trip_status'];
          news_id: string | null;
          created_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Partial<Omit<Database['public']['Tables']['trips']['Row'], 'id' | 'created_at' | 'updated_at'>> & {
          slug: string;
          title: string;
          starts_on: string;
          ends_on: string;
          max_pilots: number;
        };
        Update: Partial<Omit<Database['public']['Tables']['trips']['Row'], 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      trip_sites: {
        Row: { trip_id: string; site_id: string; position: number };
        Insert: { trip_id: string; site_id: string; position?: number };
        Update: { position?: number };
        Relationships: [
          {
            foreignKeyName: 'trip_sites_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_sites_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_guides: {
        Row: { trip_id: string; user_id: string; role_label: string | null; position: number };
        Insert: { trip_id: string; user_id: string; role_label?: string | null; position?: number };
        Update: { role_label?: string | null; position?: number };
        Relationships: [
          {
            foreignKeyName: 'trip_guides_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_interests: {
        Row: { trip_id: string; user_id: string; created_at: Timestamp };
        Insert: { trip_id: string; user_id: string };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'trip_interests_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_registrations: {
        Row: {
          id: string;
          trip_id: string;
          user_id: string;
          status: Database['public']['Enums']['trip_registration_status'];
          companions: number;
          note: string | null;
          phone: string | null;
          emergency_name: string | null;
          emergency_phone: string | null;
          pilot_level: Database['public']['Enums']['pilot_level'] | null;
          years_flying: number | null;
          logged_flights: number | null;
          payment_status: Database['public']['Enums']['trip_payment_status'];
          staff_note: string | null;
          decided_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: never;
        Update: {
          status?: Database['public']['Enums']['trip_registration_status'];
          payment_status?: Database['public']['Enums']['trip_payment_status'];
          staff_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_registrations_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description_md: string;
          kind: Database['public']['Enums']['event_kind'];
          starts_at: Timestamp;
          ends_at: Timestamp;
          site_id: string | null;
          location_text: string | null;
          members_only: boolean;
          capacity: number | null;
          rsvp_deadline: Timestamp | null;
          status: Database['public']['Enums']['event_status'];
          created_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          slug: string;
          title: string;
          description_md?: string;
          kind?: Database['public']['Enums']['event_kind'];
          starts_at: Timestamp;
          ends_at: Timestamp;
          site_id?: string | null;
          location_text?: string | null;
          members_only?: boolean;
          capacity?: number | null;
          rsvp_deadline?: Timestamp | null;
          status?: Database['public']['Enums']['event_status'];
          created_by?: string | null;
        };
        Update: {
          slug?: string;
          title?: string;
          description_md?: string;
          kind?: Database['public']['Enums']['event_kind'];
          starts_at?: Timestamp;
          ends_at?: Timestamp;
          site_id?: string | null;
          location_text?: string | null;
          members_only?: boolean;
          capacity?: number | null;
          rsvp_deadline?: Timestamp | null;
          status?: Database['public']['Enums']['event_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'events_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      event_rsvps: {
        Row: {
          event_id: string;
          user_id: string;
          status: Database['public']['Enums']['rsvp_status'];
          note: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { event_id: string; user_id: string; status: Database['public']['Enums']['rsvp_status']; note?: string | null };
        Update: { status?: Database['public']['Enums']['rsvp_status']; note?: string | null };
        Relationships: [
          {
            foreignKeyName: 'event_rsvps_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      notices: {
        Row: {
          id: string;
          user_id: string;
          kind: Database['public']['Enums']['notice_kind'];
          category: Database['public']['Enums']['notice_category'];
          title: string;
          body: string | null;
          site_id: string | null;
          place_text: string | null;
          notice_date: string | null;
          seats: number | null;
          price: number | null;
          currency: string | null;
          photo_path: string | null;
          closed: boolean;
          expires_at: Timestamp;
          created_at: Timestamp;
        };
        Insert: {
          user_id: string;
          kind: Database['public']['Enums']['notice_kind'];
          category: Database['public']['Enums']['notice_category'];
          title: string;
          body?: string | null;
          site_id?: string | null;
          place_text?: string | null;
          notice_date?: string | null;
          seats?: number | null;
          price?: number | null;
          currency?: string | null;
          photo_path?: string | null;
        };
        Update: {
          kind?: Database['public']['Enums']['notice_kind'];
          category?: Database['public']['Enums']['notice_category'];
          title?: string;
          body?: string | null;
          site_id?: string | null;
          place_text?: string | null;
          notice_date?: string | null;
          seats?: number | null;
          price?: number | null;
          currency?: string | null;
          photo_path?: string | null;
          closed?: boolean;
          expires_at?: Timestamp;
        };
        Relationships: [
          {
            foreignKeyName: 'notices_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      rides: {
        Row: {
          id: string;
          user_id: string;
          kind: Database['public']['Enums']['ride_kind'];
          purpose: Database['public']['Enums']['ride_purpose'];
          ride_date: string;
          depart_time: string | null;
          from_text: string;
          site_id: string | null;
          to_text: string | null;
          seats: number | null;
          note: string | null;
          closed: boolean;
          created_at: Timestamp;
        };
        Insert: {
          user_id: string;
          kind: Database['public']['Enums']['ride_kind'];
          purpose?: Database['public']['Enums']['ride_purpose'];
          ride_date: string;
          depart_time?: string | null;
          from_text: string;
          site_id?: string | null;
          to_text?: string | null;
          seats?: number | null;
          note?: string | null;
        };
        Update: {
          kind?: Database['public']['Enums']['ride_kind'];
          purpose?: Database['public']['Enums']['ride_purpose'];
          ride_date?: string;
          depart_time?: string | null;
          from_text?: string;
          site_id?: string | null;
          to_text?: string | null;
          seats?: number | null;
          note?: string | null;
          closed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'rides_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      weather_forecasts: {
        Row: { site_id: string; fetched_at: Timestamp; data: Json };
        Insert: { site_id: string; fetched_at?: Timestamp; data: Json };
        Update: { fetched_at?: Timestamp; data?: Json };
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
          flying_since: number | null;
          weight_kg: number | null;
          total_flight_hours: number | null;
          total_flights: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_flights_to_totals: { Args: { p_flights: string[] }; Returns: number };
      add_incident_injury: { Args: { p_incident: string; p_details_enc: string }; Returns: undefined };
      read_incident_injury: { Args: { p_incident: string }; Returns: string | null };
      log_incident_view: { Args: { p_incident: string }; Returns: undefined };
      incident_stats: {
        Args: Record<string, never>;
        Returns: {
          year: number;
          category: Database['public']['Enums']['incident_category'];
          severity: Database['public']['Enums']['incident_severity'];
          reports: number;
        }[];
      };
      trip_counts: {
        Args: { p_trip: string };
        Returns: {
          seats_taken: number;
          accepted: number;
          pending: number;
          waitlisted: number;
          interested: number;
        }[];
      };
      register_for_trip: {
        Args: {
          p_trip: string;
          p_companions?: number;
          p_note?: string | null;
          p_phone?: string | null;
          p_emergency_name?: string | null;
          p_emergency_phone?: string | null;
        };
        Returns: Database['public']['Enums']['trip_registration_status'];
      };
      cancel_trip_registration: { Args: { p_trip: string }; Returns: undefined };
      update_trip_registration: {
        Args: {
          p_trip: string;
          p_note: string | null;
          p_phone: string | null;
          p_emergency_name: string | null;
          p_emergency_phone: string | null;
        };
        Returns: undefined;
      };
      notify_trip_followers: {
        Args: { p_trip: string; p_include_registered?: boolean };
        Returns: number;
      };
      event_counts: { Args: { p_event: string }; Returns: { going: number; maybe: number }[] };
      create_group_chat: { Args: { p_title: string; p_members: string[] }; Returns: string };
      add_group_member: { Args: { p_chat: string; p_user: string }; Returns: undefined };
      remove_group_member: { Args: { p_chat: string; p_user: string }; Returns: undefined };
      rename_group_chat: { Args: { p_chat: string; p_title: string }; Returns: undefined };
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
      nearest_site: {
        Args: { p_lat: number; p_lng: number; p_max_m?: number };
        Returns: string | null;
      };
      pilot_stats: {
        Args: { p_user: string };
        Returns: {
          flights: number;
          total_s: number;
          longest_s: number | null;
          max_distance_m: number | null;
          max_straight_m: number | null;
          max_alt_m: number | null;
          max_climb_ms: number | null;
          first_flight: Timestamp | null;
          last_flight: Timestamp | null;
          sites: number;
        }[];
      };
      follow_counts: {
        Args: { p_user: string };
        Returns: { followers: number; following: number }[];
      };
      reported_chat_messages: {
        Args: { p_report: string };
        Returns: Database['public']['Tables']['messages']['Row'][];
      };
      ban_user: { Args: { p_user: string; p_until: Timestamp | null; p_reason: string }; Returns: undefined };
      touch_last_seen: { Args: Record<string, never>; Returns: undefined };
      send_club_message: {
        Args: {
          p_audience: 'all' | 'role' | 'group';
          p_role: Database['public']['Enums']['app_role'] | null;
          p_group: string | null;
          p_title: string;
          p_body: string;
        };
        Returns: string;
      };
      admin_update_profile: {
        Args: {
          p_user: string;
          p_display_name: string;
          p_full_name: string | null;
          p_city: string | null;
          p_home_site: string | null;
          p_pilot_level: Database['public']['Enums']['pilot_level'] | null;
          p_bio: string | null;
          p_remove_photo?: boolean;
        };
        Returns: string | null;
      };
      admin_user_overview: { Args: { p_user: string }; Returns: Json };
      admin_update_profile_details: {
        Args: {
          p_user: string;
          p_country: string | null;
          p_flying_since: number | null;
          p_licence_body: string | null;
        };
        Returns: undefined;
      };
      admin_request_account_deletion: { Args: { p_user: string; p_reason: string }; Returns: string };
    };
    Enums: {
      app_role:
        | 'student_pilot'
        | 'pilot'
        | 'member'
        | 'instructor'
        | 'guide'
        | 'moderator'
        | 'safety_officer'
        | 'trip_organiser'
        | 'admin'
        | 'super_admin';
      trip_status: 'draft' | 'open' | 'closed' | 'completed' | 'cancelled';
      trip_registration_status: 'pending' | 'accepted' | 'waitlisted' | 'declined' | 'cancelled';
      trip_payment_status: 'unpaid' | 'deposit_paid' | 'paid' | 'refunded';
      visibility: 'public' | 'members' | 'private';
      account_status: 'onboarding' | 'pending_guardian' | 'active' | 'deletion_requested';
      age_group: 'minor' | 'adult';
      pilot_level:
        | 'student'
        | 'p1'
        | 'p2'
        | 'p3'
        | 'p4'
        | 'p5'
        | 't1'
        | 't2'
        | 't3'
        | 'tandem'
        | 'instructor';
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
      report_target: 'ad' | 'user' | 'chat' | 'message' | 'news_comment' | 'tip' | 'ride' | 'event' | 'notice';
      report_reason: 'spam' | 'scam' | 'harassment' | 'hate' | 'sexual' | 'dangerous' | 'illegal' | 'other';
      report_status: 'open' | 'actioned' | 'dismissed';
      chat_kind: 'direct' | 'group';
      site_kind: 'launch' | 'landing' | 'both';
      equipment_kind: 'wing' | 'harness' | 'reserve' | 'instrument' | 'helmet' | 'radio' | 'other';
      flight_source: 'igc' | 'gpx' | 'manual';
      incident_anonymity: 'named' | 'community_anonymous' | 'fully_anonymous';
      incident_category:
        | 'collapse'
        | 'spiral_or_spin'
        | 'reserve_deployment'
        | 'takeoff'
        | 'landing'
        | 'tree_landing'
        | 'water_landing'
        | 'collision'
        | 'power_line'
        | 'equipment_failure'
        | 'weather'
        | 'medical'
        | 'other';
      incident_severity: 'near_miss' | 'minor' | 'serious' | 'fatal';
      incident_status: 'submitted' | 'in_review' | 'closed';
      lesson_status: 'draft' | 'published';
      event_kind: 'club_trip' | 'course' | 'competition' | 'social' | 'meeting' | 'other';
      event_status: 'draft' | 'published' | 'cancelled';
      rsvp_status: 'going' | 'maybe' | 'not_going';
      notice_kind: 'offer' | 'request';
      notice_category: 'transport' | 'gear' | 'buddy' | 'training' | 'lost_found' | 'other';
      ride_kind: 'offer' | 'request';
      ride_purpose: 'carpool' | 'retrieve';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
