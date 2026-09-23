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
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      billing_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          plan_id: string | null
          status: string
          stripe_invoice_id: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan_id?: string | null
          status: string
          stripe_invoice_id: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan_id?: string | null
          status?: string
          stripe_invoice_id?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'billing_payments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          current_period_end: string | null
          plan_id: string
          status: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          plan_id: string
          status: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          plan_id?: string
          status?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'billing_subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      board_columns: {
        Row: {
          board_id: string
          cards: Json
          created_at: string
          id: string
          position: number
          status_key: string
          title: string
          updated_at: string
        }
        Insert: {
          board_id: string
          cards?: Json
          created_at?: string
          id?: string
          position: number
          status_key: string
          title: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          cards?: Json
          created_at?: string
          id?: string
          position?: number
          status_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'board_columns_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
        ]
      }
      board_messages: {
        Row: {
          ai_result_summary: string | null
          ai_run_status: string
          author_id: string
          board_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          ai_result_summary?: string | null
          ai_run_status?: string
          author_id: string
          board_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          ai_result_summary?: string | null
          ai_run_status?: string
          author_id?: string
          board_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'board_messages_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'board_messages_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
        ]
      }
      board_members: {
        Row: {
          board_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'board_members_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'board_members_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          description: string
          id: string
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          owner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_preset: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          role: string
          stripe_customer_id: string | null
          telegram_username: string | null
        }
        Insert: {
          avatar_preset?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          role: string
          stripe_customer_id?: string | null
          telegram_username?: string | null
        }
        Update: {
          avatar_preset?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          stripe_customer_id?: string | null
          telegram_username?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          created_at: string
          profile_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_assignees_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_assignees_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      task_comments: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_url: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          author_id: string
          body?: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_comments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          board_id: string
          column_id: string
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          kind: string
          parent_id: string | null
          position: number
          priority: string
          status: string
          tags: Json
          title: string
          updated_at: string
        }
        Insert: {
          board_id: string
          column_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          position?: number
          priority?: string
          status: string
          tags?: Json
          title: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          column_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          position?: number
          priority?: string
          status?: string
          tags?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_column_id_fkey'
            columns: ['column_id']
            isOneToOne: false
            referencedRelation: 'board_columns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      telegram_assignment_notifications: {
        Row: {
          attempts: number
          chat_id: number
          created_at: string
          error: string | null
          id: string
          profile_id: string
          sent_at: string | null
          status: string
          task_id: string
        }
        Insert: {
          attempts?: number
          chat_id: number
          created_at?: string
          error?: string | null
          id?: string
          profile_id: string
          sent_at?: string | null
          status?: string
          task_id: string
        }
        Update: {
          attempts?: number
          chat_id?: number
          created_at?: string
          error?: string | null
          id?: string
          profile_id?: string
          sent_at?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'telegram_assignment_notifications_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'telegram_assignment_notifications_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      telegram_bot_state: {
        Row: {
          id: string
          last_update_id: number
          updated_at: string
        }
        Insert: {
          id: string
          last_update_id?: number
          updated_at?: string
        }
        Update: {
          id?: string
          last_update_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_processed_updates: {
        Row: {
          chat_id: number
          processed_at: string
          update_id: number
        }
        Insert: {
          chat_id: number
          processed_at?: string
          update_id: number
        }
        Update: {
          chat_id?: number
          processed_at?: string
          update_id?: number
        }
        Relationships: []
      }
      telegram_profile_links: {
        Row: {
          chat_id: number
          last_seen_at: string
          linked_at: string
          profile_id: string
          telegram_username: string | null
        }
        Insert: {
          chat_id: number
          last_seen_at?: string
          linked_at?: string
          profile_id: string
          telegram_username?: string | null
        }
        Update: {
          chat_id?: number
          last_seen_at?: string
          linked_at?: string
          profile_id?: string
          telegram_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'telegram_profile_links_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      telegram_task_sessions: {
        Row: {
          chat_id: number
          profile_id: string
          selected_board_id: string | null
          state: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          profile_id: string
          selected_board_id?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          profile_id?: string
          selected_board_id?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'telegram_task_sessions_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'telegram_task_sessions_selected_board_id_fkey'
            columns: ['selected_board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_telegram_bot_secrets: {
        Args: never
        Returns: {
          bot_token: string
          poll_secret: string
        }[]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
