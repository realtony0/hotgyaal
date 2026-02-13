import { getSupabase } from '../lib/supabase'
import type { StoreSettingsPayload } from '../types'

const SETTINGS_ROW_ID = 1
const MISSING_TABLE_CODE = '42P01'
const MISSING_TABLE_SCHEMA_CACHE_CODE = 'PGRST205'

export const DEFAULT_STORE_SETTINGS: StoreSettingsPayload = {
  announcement_text:
    'Mode femme & accessoires · Vente au Senegal · Importation directe Chine',
  hero_eyebrow: 'Mode Femme & Accessoires',
  hero_title: 'Vetements, accessoires et chaussures tendance au Senegal.',
  hero_description:
    'HOTGYAAL met en avant la mode feminine: robes, tops, ensembles, sacs, bijoux et chaussures. Les produits sont selectionnes en Chine puis proposes au marche senegalais.',
  contact_intro:
    "HOTGYAAL vend au Senegal et source ses collections en Chine via une activite d'import-export.",
  contact_phone: '+221 77 493 14 74',
  contact_email: 'sophieniang344@gmail.com',
  contact_hours: 'lundi a samedi, 9h - 19h',
  footer_blurb:
    'Specialiste mode femme, accessoires et chaussures. Vente au Senegal avec importation directe depuis la Chine.',
  order_chat_number: '774931474',
}

const normalizeStoreSettings = (
  value: Partial<StoreSettingsPayload> | null | undefined,
): StoreSettingsPayload => ({
  announcement_text:
    value?.announcement_text?.trim() || DEFAULT_STORE_SETTINGS.announcement_text,
  hero_eyebrow: value?.hero_eyebrow?.trim() || DEFAULT_STORE_SETTINGS.hero_eyebrow,
  hero_title: value?.hero_title?.trim() || DEFAULT_STORE_SETTINGS.hero_title,
  hero_description:
    value?.hero_description?.trim() || DEFAULT_STORE_SETTINGS.hero_description,
  contact_intro:
    value?.contact_intro?.trim() || DEFAULT_STORE_SETTINGS.contact_intro,
  contact_phone:
    value?.contact_phone?.trim() || DEFAULT_STORE_SETTINGS.contact_phone,
  contact_email:
    value?.contact_email?.trim() || DEFAULT_STORE_SETTINGS.contact_email,
  contact_hours:
    value?.contact_hours?.trim() || DEFAULT_STORE_SETTINGS.contact_hours,
  footer_blurb: value?.footer_blurb?.trim() || DEFAULT_STORE_SETTINGS.footer_blurb,
  order_chat_number:
    value?.order_chat_number?.trim() || DEFAULT_STORE_SETTINGS.order_chat_number,
})

const isMissingSettingsTableError = (error: { code?: string; message?: string }) => {
  const code = error.code || ''
  const message = (error.message || '').toLowerCase()

  return (
    code === MISSING_TABLE_CODE ||
    code === MISSING_TABLE_SCHEMA_CACHE_CODE ||
    (message.includes('could not find the table') &&
      message.includes('store_settings'))
  )
}

export const getStoreSettings = async (): Promise<StoreSettingsPayload> => {
  const client = getSupabase()
  const { data, error } = await client
    .from('store_settings')
    .select('*')
    .eq('id', SETTINGS_ROW_ID)
    .maybeSingle()

  if (error) {
    if (isMissingSettingsTableError(error)) {
      return DEFAULT_STORE_SETTINGS
    }
    throw new Error(error.message)
  }

  if (!data) {
    return DEFAULT_STORE_SETTINGS
  }

  return normalizeStoreSettings(data as Partial<StoreSettingsPayload>)
}

export const upsertStoreSettings = async (
  payload: StoreSettingsPayload,
): Promise<StoreSettingsPayload> => {
  const client = getSupabase()
  const { data, error } = await client
    .from('store_settings')
    .upsert(
      {
        id: SETTINGS_ROW_ID,
        ...normalizeStoreSettings(payload),
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single()

  if (error) {
    if (isMissingSettingsTableError(error)) {
      throw new Error(
        'Table store_settings manquante dans Supabase. Lancez le SQL full_setup.sql mis a jour.',
      )
    }

    throw new Error(error.message)
  }

  return normalizeStoreSettings(data as Partial<StoreSettingsPayload>)
}
