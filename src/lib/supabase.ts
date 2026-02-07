import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
)

export const supabase = (() => {
  if (!isSupabaseConfigured) {
    return null
  }

  return createClient(supabaseUrl as string, supabasePublishableKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
})()

export const getSupabase = () => {
  if (!supabase) {
    throw new Error(
      'Supabase n\'est pas configure. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env.',
    )
  }

  return supabase
}
