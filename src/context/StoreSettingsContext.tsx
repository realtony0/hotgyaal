import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  DEFAULT_STORE_SETTINGS,
  getStoreSettings,
  upsertStoreSettings,
} from '../services/storeSettings'
import type { StoreSettingsPayload } from '../types'

type StoreSettingsContextValue = {
  settings: StoreSettingsPayload
  loading: boolean
  error: string | null
  refreshSettings: () => Promise<void>
  saveSettings: (payload: StoreSettingsPayload) => Promise<void>
}

const StoreSettingsContext = createContext<StoreSettingsContextValue | undefined>(
  undefined,
)

type StoreSettingsProviderProps = {
  children: ReactNode
}

export const StoreSettingsProvider = ({ children }: StoreSettingsProviderProps) => {
  const [settings, setSettings] = useState<StoreSettingsPayload>(
    DEFAULT_STORE_SETTINGS,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshSettings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSettings(DEFAULT_STORE_SETTINGS)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await getStoreSettings()
      setSettings(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Impossible de charger les reglages du site.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const saveSettings = useCallback(async (payload: StoreSettingsPayload) => {
    const normalizedPayload: StoreSettingsPayload = {
      announcement_text: payload.announcement_text.trim(),
      hero_eyebrow: payload.hero_eyebrow.trim(),
      hero_title: payload.hero_title.trim(),
      hero_description: payload.hero_description.trim(),
      contact_intro: payload.contact_intro.trim(),
      contact_phone: payload.contact_phone.trim(),
      contact_email: payload.contact_email.trim(),
      contact_hours: payload.contact_hours.trim(),
      footer_blurb: payload.footer_blurb.trim(),
      order_chat_number: payload.order_chat_number.trim(),
    }

    const previous = settings
    setSettings(normalizedPayload)
    setError(null)

    try {
      if (!isSupabaseConfigured) {
        return
      }
      const saved = await upsertStoreSettings(normalizedPayload)
      setSettings(saved)
    } catch (saveError) {
      setSettings(previous)
      throw saveError
    }
  }, [settings])

  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  const value = useMemo<StoreSettingsContextValue>(
    () => ({
      settings,
      loading,
      error,
      refreshSettings,
      saveSettings,
    }),
    [settings, loading, error, refreshSettings, saveSettings],
  )

  return (
    <StoreSettingsContext.Provider value={value}>
      {children}
    </StoreSettingsContext.Provider>
  )
}

export const useStoreSettings = () => {
  const context = useContext(StoreSettingsContext)

  if (!context) {
    throw new Error('useStoreSettings doit etre utilise dans StoreSettingsProvider.')
  }

  return context
}
