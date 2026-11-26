import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/*
 * Client Supabase a privileges, reserve au code serveur (routes /api).
 *
 * La cle service_role contourne la RLS : elle ne doit JAMAIS etre exposee au
 * navigateur. Pas de prefixe NEXT_PUBLIC, et ce module n'est importe que depuis
 * des routes API. Le navigateur, lui, ne parle a Supabase qu'en lecture seule
 * avec la cle publishable, desormais bornee par la RLS.
 */

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey)

let cachedClient: SupabaseClient | null = null

export const getSupabaseAdmin = (): SupabaseClient => {
  if (!isSupabaseAdminConfigured) {
    throw new Error('Supabase service role non configure (SUPABASE_SERVICE_ROLE_KEY).')
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl as string, serviceRoleKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return cachedClient
}
