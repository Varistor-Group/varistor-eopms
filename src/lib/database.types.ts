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
          created_at: string
          details: string | null
          id: string
          metadata: Json | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          metadata?: Json | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          metadata?: Json | null
          performed_by?: string
        }
        Relationships: []
      }
      announcement_reactions: {
        Row: {
          announcement_id: string
          created_at: string
          emoji_type: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          emoji_type: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          emoji_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reactions_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_role: string
          content: string
          created_at: string
          id: string
          title: string
          type: string
        }
        Insert: {
          author_role?: string
          content: string
          created_at?: string
          id?: string
          title: string
          type?: string
        }
        Update: {
          author_role?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      attendance_edits: {
        Row: {
          edited_at: string
          editor_id: string
          employee_id: string
          id: string
          ledger_id: string
          new_punch_in: string | null
          new_punch_out: string | null
          new_status: string
          old_punch_in: string | null
          old_punch_out: string | null
          old_status: string
          reason: string
        }
        Insert: {
          edited_at?: string
          editor_id: string
          employee_id: string
          id?: string
          ledger_id: string
          new_punch_in?: string | null
          new_punch_out?: string | null
          new_status: string
          old_punch_in?: string | null
          old_punch_out?: string | null
          old_status: string
          reason: string
        }
        Update: {
          edited_at?: string
          editor_id?: string
          employee_id?: string
          id?: string
          ledger_id?: string
          new_punch_in?: string | null
          new_punch_out?: string | null
          new_status?: string
          old_punch_in?: string | null
          old_punch_out?: string | null
          old_status?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_edits_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_edits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_ledger: {
        Row: {
          confidence: number | null
          created_at: string
          date: string
          edited_at: string | null
          editor_id: string | null
          employee_id: string
          id: string
          is_field_employee: boolean
          override_reason: string | null
          photo_url: string | null
          punch_in: string | null
          punch_out: string | null
          source: string
          status: string
          work_hours: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          date: string
          edited_at?: string | null
          editor_id?: string | null
          employee_id: string
          id?: string
          is_field_employee?: boolean
          override_reason?: string | null
          photo_url?: string | null
          punch_in?: string | null
          punch_out?: string | null
          source?: string
          status?: string
          work_hours?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          date?: string
          edited_at?: string | null
          editor_id?: string | null
          employee_id?: string
          id?: string
          is_field_employee?: boolean
          override_reason?: string | null
          photo_url?: string | null
          punch_in?: string | null
          punch_out?: string | null
          source?: string
          status?: string
          work_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_ledger_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          employee_id: string
          filename: string
          id: string
          size: string | null
          status: string
          storage_path: string | null
          type: string
          upload_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          filename: string
          id?: string
          size?: string | null
          status?: string
          storage_path?: string | null
          type?: string
          upload_date?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          filename?: string
          id?: string
          size?: string | null
          status?: string
          storage_path?: string | null
          type?: string
          upload_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          created_at: string
          department: string
          employee_id: string
          full_name: string
          id: string
          is_field_employee: boolean
          personal_email: string
          phone: string | null
          reporting_manager: string | null
          role: string
          status: string
          temp_password: string | null
          username: string
          vari_points: number
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          department: string
          employee_id: string
          full_name: string
          id: string
          is_field_employee?: boolean
          personal_email: string
          phone?: string | null
          reporting_manager?: string | null
          role?: string
          status?: string
          temp_password?: string | null
          username: string
          vari_points?: number
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          department?: string
          employee_id?: string
          full_name?: string
          id?: string
          is_field_employee?: boolean
          personal_email?: string
          phone?: string | null
          reporting_manager?: string | null
          role?: string
          status?: string
          temp_password?: string | null
          username?: string
          vari_points?: number
        }
        Relationships: []
      }
      field_attendance_photos: {
        Row: {
          confidence_score: number | null
          date: string
          employee_id: string
          id: string
          latitude: number | null
          location_accuracy: number | null
          longitude: number | null
          photo_url: string
          punch_time: string
          punch_type: string
          storage_path: string
          uploaded_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          confidence_score?: number | null
          date: string
          employee_id: string
          id?: string
          latitude?: number | null
          location_accuracy?: number | null
          longitude?: number | null
          photo_url?: string
          punch_time?: string
          punch_type?: string
          storage_path?: string
          uploaded_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          confidence_score?: number | null
          date?: string
          employee_id?: string
          id?: string
          latitude?: number | null
          location_accuracy?: number | null
          longitude?: number | null
          photo_url?: string
          punch_time?: string
          punch_type?: string
          storage_path?: string
          uploaded_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_attendance_photos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_attendance_photos_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          apply_to_all: boolean
          created_at: string
          created_by: string | null
          date: string
          id: string
          occasion: string
          type: string
        }
        Insert: {
          apply_to_all?: boolean
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          occasion: string
          type?: string
        }
        Update: {
          apply_to_all?: boolean
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          occasion?: string
          type?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          casual_total: number
          casual_used: number
          earned_total: number
          earned_used: number
          employee_id: string
          id: string
          sick_total: number
          sick_used: number
          unpaid_taken: number
          updated_at: string
        }
        Insert: {
          casual_total?: number
          casual_used?: number
          earned_total?: number
          earned_used?: number
          employee_id: string
          id?: string
          sick_total?: number
          sick_used?: number
          unpaid_taken?: number
          updated_at?: string
        }
        Update: {
          casual_total?: number
          casual_used?: number
          earned_total?: number
          earned_used?: number
          employee_id?: string
          id?: string
          sick_total?: number
          sick_used?: number
          unpaid_taken?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          days: number
          department: string
          employee_id: string
          employee_name: string
          from_date: string
          id: string
          reason: string
          rejection_comment: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          status: string
          submitted_at: string
          to_date: string
          type: string
        }
        Insert: {
          days?: number
          department: string
          employee_id: string
          employee_name: string
          from_date: string
          id?: string
          reason?: string
          rejection_comment?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          status?: string
          submitted_at?: string
          to_date: string
          type: string
        }
        Update: {
          days?: number
          department?: string
          employee_id?: string
          employee_name?: string
          from_date?: string
          id?: string
          reason?: string
          rejection_comment?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          status?: string
          submitted_at?: string
          to_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_audit: {
        Row: {
          action: string
          changes: Json | null
          id: string
          performed_by: string
          record_id: string
          timestamp: string
        }
        Insert: {
          action: string
          changes?: Json | null
          id?: string
          performed_by: string
          record_id: string
          timestamp?: string
        }
        Update: {
          action?: string
          changes?: Json | null
          id?: string
          performed_by?: string
          record_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_audit_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_formula: boolean
          cl_balance: number
          components: Json
          created_at: string
          ctc: number
          department: string
          designation: string
          employee_id: string
          employee_name: string
          id: string
          month: string
          monthly_salary: number
          net_pay: number
          pay_days: number
          pf_uan: string | null
          revision: number
          status: string
          total_days: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_formula?: boolean
          cl_balance?: number
          components?: Json
          created_at?: string
          ctc?: number
          department: string
          designation?: string
          employee_id: string
          employee_name: string
          id?: string
          month: string
          monthly_salary?: number
          net_pay?: number
          pay_days?: number
          pf_uan?: string | null
          revision?: number
          status?: string
          total_days?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_formula?: boolean
          cl_balance?: number
          components?: Json
          created_at?: string
          ctc?: number
          department?: string
          designation?: string
          employee_id?: string
          employee_name?: string
          id?: string
          month?: string
          monthly_salary?: number
          net_pay?: number
          pay_days?: number
          pf_uan?: string | null
          revision?: number
          status?: string
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          content: string
          created_at: string
          effective_date: string
          id: string
          target: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          effective_date?: string
          id?: string
          target?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          effective_date?: string
          id?: string
          target?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          attempted_at: string
          employee_id: string
          id: string
          module_id: string
          passed: boolean
          score: number
        }
        Insert: {
          answers?: Json
          attempted_at?: string
          employee_id: string
          id?: string
          module_id: string
          passed?: boolean
          score?: number
        }
        Update: {
          answers?: Json
          attempted_at?: string
          employee_id?: string
          id?: string
          module_id?: string
          passed?: boolean
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_index: number
          created_at: string
          id: string
          module_id: string
          options: string[]
          question: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          id?: string
          module_id: string
          options: string[]
          question: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          id?: string
          module_id?: string
          options?: string[]
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          created_at: string
          department: string | null
          description: string
          duration_seconds: number
          id: string
          is_seed: boolean
          order: number
          prerequisite_id: string | null
          thumbnail_url: string | null
          title: string
          track: string
          video_url: string | null
          visible_to_roles: string[] | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string
          duration_seconds?: number
          id?: string
          is_seed?: boolean
          order?: number
          prerequisite_id?: string | null
          thumbnail_url?: string | null
          title: string
          track?: string
          video_url?: string | null
          visible_to_roles?: string[] | null
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string
          duration_seconds?: number
          id?: string
          is_seed?: boolean
          order?: number
          prerequisite_id?: string | null
          thumbnail_url?: string | null
          title?: string
          track?: string
          video_url?: string | null
          visible_to_roles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_prerequisite_id_fkey"
            columns: ["prerequisite_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_progress: {
        Row: {
          completed: boolean
          created_at: string
          employee_id: string
          id: string
          module_id: string
          updated_at: string
          watched_seconds: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          employee_id: string
          id?: string
          module_id: string
          updated_at?: string
          watched_seconds?: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          module_id?: string
          updated_at?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_employee_with_auth: {
        Args: {
          p_avatar_url?: string
          p_department: string
          p_employee_id: string
          p_full_name: string
          p_is_field_employee: boolean
          p_personal_email: string
          p_phone: string
          p_reporting_manager: string
          p_role: string
          p_temp_password: string
          p_username: string
        }
        Returns: Json
      }
      current_employee_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      delete_employee_with_auth: {
        Args: {
          p_employee_id: string
        }
        Returns: Json
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
    Enums: {},
  },
} as const
