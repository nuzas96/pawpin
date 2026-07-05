/**
 * Hand-authored database types for PawPin, mirroring supabase/migrations.
 *
 * In a longer-lived project these would be generated via
 * `supabase gen types typescript`. For the hackathon foundation they are
 * maintained by hand to keep judge setup dependency-free. Keep in sync with
 * supabase/migrations/0002_tables.sql.
 */

export type UserRole = "user" | "volunteer" | "org" | "admin";
export type MatchDecision = "pending" | "linked" | "rejected" | "new_profile_created";
export type CaseStatus =
  | "reported"
  | "under_review"
  | "active"
  | "tnr_in_progress"
  | "medical"
  | "ready_for_adoption"
  | "adopted"
  | "released"
  | "closed";
export type UrgencyLevel = "low" | "medium" | "high" | "critical";
export type CoatColor =
  | "black"
  | "white"
  | "grey"
  | "orange"
  | "brown"
  | "calico"
  | "tabby"
  | "tortoiseshell"
  | "tuxedo"
  | "mixed"
  | "other";
export type FurPattern =
  | "solid"
  | "tabby"
  | "bicolor"
  | "tricolor"
  | "pointed"
  | "spotted"
  | "other";
export type SizeClass = "kitten" | "small" | "medium" | "large";
export type AgeGroup = "kitten" | "juvenile" | "adult" | "senior" | "unknown";
export type TnrStatus =
  | "not_started"
  | "trapped"
  | "neutered"
  | "recovering"
  | "returned";
export type FeedingType = "scheduled" | "ad_hoc";
export type FlagReason =
  | "spam"
  | "inappropriate"
  | "duplicate"
  | "wrong_info"
  | "abuse"
  | "other";

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          display_name: string | null;
          org_id: string | null;
          is_approved: boolean;
        } & Timestamps;
        Insert: {
          id: string;
          role?: UserRole;
          display_name?: string | null;
          org_id?: string | null;
          is_approved?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          contact_email: string | null;
          is_approved: boolean;
          verified_by: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          contact_email?: string | null;
          is_approved?: boolean;
          verified_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      cats: {
        Row: {
          id: string;
          status: CaseStatus;
          coat_color: CoatColor;
          fur_pattern: FurPattern;
          size_class: SizeClass;
          age_group: AgeGroup;
          distinguishing_marks: string[];
          ear_tipped: boolean;
          primary_photo_id: string | null;
          first_seen_at: string;
          last_seen_at: string;
          created_by: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          status?: CaseStatus;
          coat_color: CoatColor;
          fur_pattern: FurPattern;
          size_class: SizeClass;
          age_group?: AgeGroup;
          distinguishing_marks?: string[];
          ear_tipped?: boolean;
          primary_photo_id?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cats"]["Insert"]>;
        Relationships: [];
      };
      sightings: {
        Row: {
          id: string;
          cat_id: string | null;
          reporter_id: string | null;
          photo_id: string | null;
          lat: number;
          lng: number;
          urgency: UrgencyLevel;
          condition_tags: string[];
          notes: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          cat_id?: string | null;
          reporter_id?: string | null;
          photo_id?: string | null;
          lat: number;
          lng: number;
          urgency?: UrgencyLevel;
          condition_tags?: string[];
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sightings"]["Insert"]>;
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          storage_path: string;
          uploaded_by: string | null;
          width: number | null;
          height: number | null;
          mime: string | null;
          sha256: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          storage_path: string;
          uploaded_by?: string | null;
          width?: number | null;
          height?: number | null;
          mime?: string | null;
          sha256?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
        Relationships: [];
      };
      cases: {
        Row: {
          id: string;
          cat_id: string;
          status: CaseStatus;
          claimed_by: string | null;
          org_id: string | null;
          priority: UrgencyLevel;
          opened_at: string;
          closed_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          cat_id: string;
          status?: CaseStatus;
          claimed_by?: string | null;
          org_id?: string | null;
          priority?: UrgencyLevel;
          opened_at?: string;
          closed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cases"]["Insert"]>;
        Relationships: [];
      };
      case_events: {
        Row: {
          id: string;
          case_id: string;
          type: string;
          actor_id: string | null;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          type: string;
          actor_id?: string | null;
          payload?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["case_events"]["Insert"]>;
        Relationships: [];
      };
      feeding_schedules: {
        Row: {
          id: string;
          case_id: string;
          created_by: string | null;
          schedule_text: string;
          location_note: string | null;
          active: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          case_id: string;
          created_by?: string | null;
          schedule_text: string;
          location_note?: string | null;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["feeding_schedules"]["Insert"]>;
        Relationships: [];
      };
      feeding_logs: {
        Row: {
          id: string;
          case_id: string;
          schedule_id: string | null;
          fed_by: string | null;
          fed_at: string;
          notes: string | null;
          photo_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          schedule_id?: string | null;
          fed_by?: string | null;
          fed_at?: string;
          notes?: string | null;
          photo_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feeding_logs"]["Insert"]>;
        Relationships: [];
      };
      tnr_records: {
        Row: {
          id: string;
          case_id: string;
          tnr_status: TnrStatus;
          clinic: string | null;
          trapped_at: string | null;
          neutered_at: string | null;
          returned_at: string | null;
          notes: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          case_id: string;
          tnr_status?: TnrStatus;
          clinic?: string | null;
          trapped_at?: string | null;
          neutered_at?: string | null;
          returned_at?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tnr_records"]["Insert"]>;
        Relationships: [];
      };
      adoptions: {
        Row: {
          id: string;
          cat_id: string;
          adopter_contact: string | null;
          status: string;
          finalized_at: string | null;
          handled_by: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          cat_id: string;
          adopter_contact?: string | null;
          status?: string;
          finalized_at?: string | null;
          handled_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["adoptions"]["Insert"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          cat_id: string | null;
          case_id: string | null;
          author_id: string | null;
          body: string;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          cat_id?: string | null;
          case_id?: string | null;
          author_id?: string | null;
          body: string;
          is_hidden?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [];
      };
      follows: {
        Row: { user_id: string; cat_id: string; created_at: string };
        Insert: { user_id: string; cat_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
        Relationships: [];
      };
      bookmarks: {
        Row: { user_id: string; cat_id: string; created_at: string };
        Insert: { user_id: string; cat_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["bookmarks"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          payload: Record<string, unknown>;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          payload?: Record<string, unknown>;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      moderation_flags: {
        Row: {
          id: string;
          target_type: string;
          target_id: string;
          reason: FlagReason;
          details: string | null;
          reported_by: string | null;
          status: string;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: string;
          target_id: string;
          reason: FlagReason;
          details?: string | null;
          reported_by?: string | null;
          status?: string;
          resolved_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["moderation_flags"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          diff: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          diff?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
      match_suggestions: {
        Row: {
          id: string;
          sighting_id: string;
          candidate_cat_id: string;
          score: number;
          reasons: Record<string, unknown> | unknown[];
          confirmed_by: string | null;
          decision: MatchDecision | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sighting_id: string;
          candidate_cat_id: string;
          score: number;
          reasons?: Record<string, unknown> | unknown[];
          confirmed_by?: string | null;
          decision?: MatchDecision | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["match_suggestions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      sighting_geo_public: {
        Row: {
          sighting_id: string;
          cat_id: string | null;
          fuzzed_lat: number;
          fuzzed_lng: number;
          urgency: UrgencyLevel;
          status: CaseStatus | null;
          created_at: string;
        };
        Relationships: [];
      };
      cats_map_public: {
        Row: {
          cat_id: string;
          status: CaseStatus;
          coat_color: CoatColor;
          fur_pattern: FurPattern;
          size_class: SizeClass;
          age_group: AgeGroup;
          distinguishing_marks: string[];
          ear_tipped: boolean;
          primary_photo_id: string | null;
          last_seen_at: string;
          urgency: UrgencyLevel;
          condition_tags: string[];
          fuzzed_lat: number;
          fuzzed_lng: number;
          last_sighting_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_volunteer: { Args: Record<string, never>; Returns: boolean };
      is_org: { Args: Record<string, never>; Returns: boolean };
      has_case_access: { Args: { case_id: string }; Returns: boolean };
      has_cat_access: { Args: { target_cat_id: string }; Returns: boolean };
      fuzz_coordinate: { Args: { value: number }; Returns: number };
      get_match_candidates: {
        Args: {
          query_lat: number;
          query_lng: number;
          max_distance_meters?: number;
          max_age_days?: number;
        };
        Returns: {
          cat_id: string;
          coat_color: CoatColor;
          fur_pattern: FurPattern;
          size_class: SizeClass;
          age_group: AgeGroup;
          distinguishing_marks: string[];
          ear_tipped: boolean;
          primary_photo_id: string | null;
          status: CaseStatus;
          last_seen_at: string;
          sighting_lat: number;
          sighting_lng: number;
          sighting_occurred_at: string;
          sighting_condition_tags: string[];
          sighting_urgency: UrgencyLevel;
        }[];
      };
      link_sighting_to_cat: {
        Args: { p_sighting_id: string; p_cat_id: string };
        Returns: { result_cat_id: string; result_case_id: string }[];
      };
      create_cat_from_sighting: {
        Args: {
          p_sighting_id: string;
          p_coat_color: CoatColor;
          p_fur_pattern: FurPattern;
          p_size_class: SizeClass;
          p_age_group: AgeGroup;
          p_ear_tipped: boolean;
          p_marks: string[];
        };
        Returns: { result_cat_id: string; result_case_id: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      case_status: CaseStatus;
      urgency_level: UrgencyLevel;
      coat_color: CoatColor;
      fur_pattern: FurPattern;
      size_class: SizeClass;
      age_group: AgeGroup;
      tnr_status: TnrStatus;
      feeding_type: FeedingType;
      flag_reason: FlagReason;
    };
  };
}
