import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import type { Customer, LoyaltyTransaction } from '../types'

const TOKEN_STORAGE_KEY = 'hotgyaal_customer_token'

type CustomerAuthContextValue = {
  customer: Customer | null
  token: string | null
  loading: boolean
  ready: boolean
  register: (input: { phone: string; pin: string; fullName?: string }) => Promise<void>
  login: (input: { phone: string; pin: string }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  updateProfile: (input: { fullName?: string; newPin?: string }) => Promise<void>
  fetchHistory: () => Promise<LoyaltyTransaction[]>
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(
  undefined,
)

const readStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

const persistToken = (nextToken: string | null) => {
  if (typeof window === 'undefined') return
  if (nextToken) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

type RpcLoginRow = {
  token: string
  customer_id: string
  phone: string
  full_name: string | null
  points_balance: number
}

type RpcMeRow = {
  customer_id: string
  phone: string
  full_name: string | null
  points_balance: number
}

const firstRow = <T,>(data: unknown): T | null => {
  if (Array.isArray(data) && data.length > 0) return data[0] as T
  if (data && typeof data === 'object') return data as T
  return null
}

const assertConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new Error('Service indisponible. Reessayez plus tard.')
  }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [token, setToken] = useState<string | null>(() => readStoredToken())
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  const syncFromToken = useCallback(async (nextToken: string) => {
    try {
      const client = getSupabase()
      const { data, error } = await client.rpc('customer_me', {
        p_token: nextToken,
      })

      if (error) {
        throw new Error(error.message)
      }

      const row = firstRow<RpcMeRow>(data)
      if (!row) {
        throw new Error('Session expiree')
      }

      setCustomer({
        customer_id: row.customer_id,
        phone: row.phone,
        full_name: row.full_name,
        points_balance: row.points_balance,
      })
      setToken(nextToken)
    } catch (error) {
      console.warn('Session client invalide', error)
      persistToken(null)
      setToken(null)
      setCustomer(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      const stored = readStoredToken()
      if (!stored || !isSupabaseConfigured) {
        setReady(true)
        return
      }

      await syncFromToken(stored)
      if (!cancelled) setReady(true)
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [syncFromToken])

  const applySession = useCallback((row: RpcLoginRow) => {
    const nextCustomer: Customer = {
      customer_id: row.customer_id,
      phone: row.phone,
      full_name: row.full_name,
      points_balance: row.points_balance,
    }
    setCustomer(nextCustomer)
    setToken(row.token)
    persistToken(row.token)
  }, [])

  const register = useCallback<CustomerAuthContextValue['register']>(
    async ({ phone, pin, fullName }) => {
      assertConfigured()
      setLoading(true)
      try {
        const client = getSupabase()
        const { data, error } = await client.rpc('customer_register', {
          p_phone: phone,
          p_pin: pin,
          p_full_name: fullName ?? null,
        })

        if (error) {
          throw new Error(error.message)
        }

        const row = firstRow<RpcLoginRow>(data)
        if (!row) {
          throw new Error('Reponse invalide du serveur')
        }

        applySession(row)
      } finally {
        setLoading(false)
      }
    },
    [applySession],
  )

  const login = useCallback<CustomerAuthContextValue['login']>(
    async ({ phone, pin }) => {
      assertConfigured()
      setLoading(true)
      try {
        const client = getSupabase()
        const { data, error } = await client.rpc('customer_login', {
          p_phone: phone,
          p_pin: pin,
        })

        if (error) {
          throw new Error(error.message)
        }

        const row = firstRow<RpcLoginRow>(data)
        if (!row) {
          throw new Error('Numero ou PIN incorrect')
        }

        applySession(row)
      } finally {
        setLoading(false)
      }
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    if (token && isSupabaseConfigured) {
      try {
        const client = getSupabase()
        await client.rpc('customer_logout', { p_token: token })
      } catch (error) {
        console.warn('Impossible de revoquer la session', error)
      }
    }

    persistToken(null)
    setToken(null)
    setCustomer(null)
  }, [token])

  const refresh = useCallback(async () => {
    if (!token) return
    await syncFromToken(token)
  }, [syncFromToken, token])

  const updateProfile = useCallback<CustomerAuthContextValue['updateProfile']>(
    async ({ fullName, newPin }) => {
      if (!token) throw new Error('Vous devez etre connecte')
      assertConfigured()

      const client = getSupabase()
      const { error } = await client.rpc('customer_update_profile', {
        p_token: token,
        p_full_name: fullName ?? null,
        p_new_pin: newPin ?? null,
      })

      if (error) throw new Error(error.message)
      await syncFromToken(token)
    },
    [syncFromToken, token],
  )

  const fetchHistory = useCallback<CustomerAuthContextValue['fetchHistory']>(async () => {
    if (!token) return []
    assertConfigured()

    const client = getSupabase()
    const { data, error } = await client.rpc('customer_loyalty_history', {
      p_token: token,
      p_limit: 20,
    })

    if (error) throw new Error(error.message)
    return (data as LoyaltyTransaction[]) ?? []
  }, [token])

  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      customer,
      token,
      loading,
      ready,
      register,
      login,
      logout,
      refresh,
      updateProfile,
      fetchHistory,
    }),
    [customer, token, loading, ready, register, login, logout, refresh, updateProfile, fetchHistory],
  )

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) {
    throw new Error('useCustomerAuth doit etre utilise dans CustomerAuthProvider')
  }
  return ctx
}
