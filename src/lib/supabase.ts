import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const DEFAULT_SUPABASE_URL = 'https://yxxwpsodzksvxpvizybt.supabase.co'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY не заданы. Добавьте их в .env.local.',
  )
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
)

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseAnonKey && supabaseAnonKey !== 'placeholder-anon-key')
}
