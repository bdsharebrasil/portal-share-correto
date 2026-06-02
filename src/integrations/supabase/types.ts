export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ctm_analise_oleo: {
        Row: {
          id: string
          aeronave_id: string
          data_analise: string
          ferro: number | null
          cobre: number | null
          aluminio: number | null
          silicio: number | null
          viscosidade: number | null
          ordem_servico_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          aeronave_id: string
          data_analise: string
          ferro?: number | null
          cobre?: number | null
          aluminio?: number | null
          silicio?: number | null
          viscosidade?: number | null
          ordem_servico_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          aeronave_id?: string
          data_analise?: string
          ferro?: number | null
          cobre?: number | null
          aluminio?: number | null
          silicio?: number | null
          viscosidade?: number | null
          ordem_servico_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      flight_booking_requests: {
        Row: {
          id: string
          client_id: string
          aeronave_id: string
          origin: string
          destination: string
          scheduled_date: string
          departure_time: string
          duration_days: number
          passenger_count: number
          status: "pendente" | "confirmado" | "rejeitado" | "cancelado"
          notes: string | null
          rejection_reason: string | null
          created_at: string
          criado_em: string
          approved_at: string | null
          approved_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          aeronave_id: string
          origin: string
          destination: string
          scheduled_date: string
          departure_time: string
          duration_days: number
          passenger_count: number
          status?: "pendente" | "confirmado" | "rejeitado" | "cancelado"
          notes?: string | null
          rejection_reason?: string | null
          created_at?: string
          criado_em?: string
          approved_at?: string | null
          approved_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          aeronave_id?: string
          origin?: string
          destination?: string
          scheduled_date?: string
          departure_time?: string
          duration_days?: number
          passenger_count?: number
          status?: "pendente" | "confirmado" | "rejeitado" | "cancelado"
          notes?: string | null
          rejection_reason?: string | null
          created_at?: string
          criado_em?: string
          approved_at?: string | null
          approved_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          id: string
          user_id: string
          start_date: string
          end_date: string
          days: number
          status: "pending" | "approved" | "rejected"
          remarks: string | null
          approver_id: string | null
          created_at: string
          criado_em: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          start_date: string
          end_date: string
          days: number
          status?: "pending" | "approved" | "rejected"
          remarks?: string | null
          approver_id?: string | null
          created_at?: string
          criado_em?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          start_date?: string
          end_date?: string
          days?: number
          status?: "pending" | "approved" | "rejected"
          remarks?: string | null
          approver_id?: string | null
          created_at?: string
          criado_em?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      app_role: "admin" | "user" | "moderator"
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
