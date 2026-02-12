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
import { listCategories } from '../services/categories'
import type { StoreCategory } from '../types'

type StoreCategoriesContextValue = {
  categories: StoreCategory[]
  loading: boolean
  error: string | null
  refreshCategories: () => Promise<void>
}

const StoreCategoriesContext = createContext<
  StoreCategoriesContextValue | undefined
>(undefined)

type StoreCategoriesProviderProps = {
  children: ReactNode
}

export const StoreCategoriesProvider = ({
  children,
}: StoreCategoriesProviderProps) => {
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCategories = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCategories([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await listCategories()
      setCategories(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Impossible de charger les categories.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshCategories()
  }, [refreshCategories])

  const value = useMemo<StoreCategoriesContextValue>(
    () => ({
      categories,
      loading,
      error,
      refreshCategories,
    }),
    [categories, loading, error, refreshCategories],
  )

  return (
    <StoreCategoriesContext.Provider value={value}>
      {children}
    </StoreCategoriesContext.Provider>
  )
}

export const useStoreCategories = () => {
  const context = useContext(StoreCategoriesContext)

  if (!context) {
    throw new Error(
      'useStoreCategories doit etre utilise dans StoreCategoriesProvider.',
    )
  }

  return context
}
