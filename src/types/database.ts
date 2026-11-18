export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string
          user_id: string
          name: string
          muscle_group: string
          supports_bilbo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          muscle_group: string
          supports_bilbo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          muscle_group?: string
          supports_bilbo?: boolean
          created_at?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          workout_date: string
          title: string
          notes: string | null
          duration_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_date: string
          title: string
          notes?: string | null
          duration_minutes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_date?: string
          title?: string
          notes?: string | null
          duration_minutes?: number | null
          created_at?: string
        }
        Relationships: []
      }
      bilbo_cycles: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          cycle_number: number
          estimated_1rm_start: number
          start_weight_kg: number
          increment_kg: number
          is_active: boolean
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          cycle_number: number
          estimated_1rm_start: number
          start_weight_kg: number
          increment_kg: number
          is_active?: boolean
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          cycle_number?: number
          estimated_1rm_start?: number
          start_weight_kg?: number
          increment_kg?: number
          is_active?: boolean
          started_at?: string
          ended_at?: string | null
        }
        Relationships: []
      }
      sets: {
        Row: {
          id: string
          user_id: string
          workout_id: string
          exercise_id: string
          bilbo_cycle_id: string | null
          set_order: number
          weight_kg: number
          reps: number
          rir: number | null
          is_bilbo_set: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_id: string
          exercise_id: string
          bilbo_cycle_id?: string | null
          set_order: number
          weight_kg: number
          reps: number
          rir?: number | null
          is_bilbo_set?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_id?: string
          exercise_id?: string
          bilbo_cycle_id?: string | null
          set_order?: number
          weight_kg?: number
          reps?: number
          rir?: number | null
          is_bilbo_set?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
