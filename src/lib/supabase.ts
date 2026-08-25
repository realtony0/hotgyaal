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

export const CATALOG_UNAVAILABLE_MESSAGE =
  'Notre catalogue est momentanement indisponible. Nos equipes travaillent au retablissement, merci de reessayer dans quelques instants.'

/**
 * Convertit une erreur technique en message client lisible. Les details bruts
 * (Supabase, reseau, SQL) restent dans la console pour le diagnostic.
 */
export const resolveCatalogErrorMessage = (error: unknown): string => {
  if (typeof console !== 'undefined') {
    console.error('[hotgyaal] chargement catalogue impossible', error)
  }

  return CATALOG_UNAVAILABLE_MESSAGE
}

export const ORDER_UNAVAILABLE_MESSAGE =
  "Votre commande n'a pas pu etre enregistree pour le moment. Merci de reessayer dans quelques instants ou de nous contacter directement."

/**
 * Meme principe que resolveCatalogErrorMessage, cote commande: le client voit
 * un message clair, le detail technique reste dans la console.
 */
export const resolveOrderErrorMessage = (error: unknown): string => {
  if (typeof console !== 'undefined') {
    console.error('[hotgyaal] enregistrement commande impossible', error)
  }

  return ORDER_UNAVAILABLE_MESSAGE
}
