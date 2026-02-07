import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

export const getSupabase = () => {
  if (!supabase) {
    throw new Error(
      'Supabase n\'est pas configuré. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env.',
    )
  }

  return supabase
}
