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
    PostgrestVersion: "17.1"
  }
  public: {
    Tables: {
      operator_application_events: {
        Row: {
          actor_id: string
          application_id: string
          created_at: string
          from_status: string
          id: string
          note: string
          to_status: string
        }
        Insert: {
          actor_id: string
          application_id: string
          created_at?: string
          from_status: string
          id?: string
          note?: string
          to_status: string
        }
        Update: {
          actor_id?: string
          application_id?: string
          created_at?: string
          from_status?: string
          id?: string
          note?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "operator_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_applications: {
        Row: {
          business_name: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          notes: string
          operating_base: string
          owner_id: string
          registration_number: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_areas: string[]
          status: string
          submitted_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          business_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          notes?: string
          operating_base?: string
          owner_id?: string
          registration_number?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_areas?: string[]
          status?: string
          submitted_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          business_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          notes?: string
          operating_base?: string
          owner_id?: string
          registration_number?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_areas?: string[]
          status?: string
          submitted_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      operator_document_requirements: {
        Row: {
          active: boolean
          code: string
          description: string
          label: string
          required: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          description?: string
          label: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          description?: string
          label?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      operator_documents: {
        Row: {
          application_id: string
          category: string
          content_type: string
          created_at: string
          file_name: string
          id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          application_id: string
          category: string
          content_type: string
          created_at?: string
          file_name: string
          id?: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          application_id?: string
          category?: string
          content_type?: string
          created_at?: string
          file_name?: string
          id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "operator_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_vehicles: {
        Row: {
          created_at: string
          description: string
          id: string
          location: string
          make: string
          model: string
          model_year: number
          operator_id: string
          plate_number: string
          seats: number
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          location: string
          make: string
          model: string
          model_year: number
          operator_id: string
          plate_number: string
          seats: number
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          location?: string
          make?: string
          model?: string
          model_year?: number
          operator_id?: string
          plate_number?: string
          seats?: number
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "operator_vehicles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator_applications"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          email_confirmed_at: string | null
          full_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          email_confirmed_at?: string | null
          full_name?: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_confirmed_at?: string | null
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      vehicle_listings: {
        Row: {
          description: string | null
          id: string | null
          location: string | null
          make: string | null
          model: string | null
          model_year: number | null
          seats: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          location?: string | null
          make?: string | null
          model?: string | null
          model_year?: number | null
          seats?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          id?: string | null
          location?: string | null
          make?: string | null
          model?: string | null
          model_year?: number | null
          seats?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_access: { Args: never; Returns: Json }
      admin_accounts: {
        Args: never
        Returns: {
          confirmed: boolean
          email: string
          role: string
          user_id: string
        }[]
      }
      admin_update_operator: {
        Args: { p_details: Json; p_id: string; p_version: number }
        Returns: undefined
      }
      check_registration_limit: { Args: { p_key: string }; Returns: boolean }
      finalize_operator_registration: {
        Args: { p_id: string }
        Returns: undefined
      }
      get_managed_vehicles: {
        Args: { p_id?: string }
        Returns: {
          created_at: string
          description: string
          id: string
          location: string
          make: string
          model: string
          model_year: number
          operator_id: string
          plate_number: string
          seats: number
          status: string
          title: string
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "operator_vehicles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      release_admin_invitation: {
        Args: { p_actor: string; p_email: string }
        Returns: undefined
      }
      reserve_admin_invitation: {
        Args: { p_actor: string; p_email: string }
        Returns: undefined
      }
      review_operator_application: {
        Args: {
          p_decision: string
          p_id: string
          p_note: string
          p_version: number
        }
        Returns: {
          business_name: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          notes: string
          operating_base: string
          owner_id: string
          registration_number: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_areas: string[]
          status: string
          submitted_at: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "operator_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_vehicle_status: {
        Args: { p_id: string; p_status: string; p_version: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
