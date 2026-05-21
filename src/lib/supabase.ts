import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '') as string
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '') as string

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep runtime-safe: will error when used if env vars are missing
  // (do not throw at import time to avoid dev server crash)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
