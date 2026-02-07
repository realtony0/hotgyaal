import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured, supabase } from '../lib/supabase'
import type { UserProfile } from '../types'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isAdmin: boolean
  loading: boolean
  unlockAdminByCode: (code: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type AuthProviderProps = {
  children: ReactNode
}

const PROFILE_NOT_FOUND_CODE = 'PGRST116'
const ADMIN_ACCESS_CODE = '142022'
const ADMIN_ACCESS_STORAGE_KEY = 'hotgyaal_admin_access'

const getProfile = async (userId: string): Promise<UserProfile | null> => {
  const client = getSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (data) {
    return data as UserProfile
  }

  const { data: createdProfile, error: createError } = await client
    .from('profiles')
    .insert({ id: userId, role: 'customer' })
    .select('*')
    .single()

  if (createError && createError.code !== PROFILE_NOT_FOUND_CODE) {
    throw new Error(createError.message)
  }

  return (createdProfile as UserProfile | null) ?? null
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [isCodeAdmin, setIsCodeAdmin] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY) === '1'
  })

  const syncProfile = useCallback(async (userId: string) => {
    try {
      const nextProfile = await getProfile(userId)
      setProfile(nextProfile)
    } catch (error) {
      console.error('Impossible de charger le profil utilisateur', error)
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return
    }

    const client = supabase
    let isMounted = true

    const initialize = async () => {
      const { data } = await client.auth.getSession()
      if (!isMounted) {
        return
      }

      setSession(data.session)

      if (data.session?.user) {
        await syncProfile(data.session.user.id)
      }

      if (isMounted) {
        setLoading(false)
      }
    }

    initialize()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)

      if (nextSession?.user) {
        await syncProfile(nextSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [syncProfile])

  const unlockAdminByCode = useCallback(async (code: string) => {
    if (code.trim() !== ADMIN_ACCESS_CODE) {
      throw new Error('Code incorrect.')
    }

    setIsCodeAdmin(true)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_ACCESS_STORAGE_KEY, '1')
    }
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw new Error(error.message)
      }
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_ACCESS_STORAGE_KEY)
    }

    setIsCodeAdmin(false)
    setProfile(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: isCodeAdmin || profile?.role === 'admin',
      loading,
      unlockAdminByCode,
      signOut,
    }),
    [isCodeAdmin, loading, profile, session, signOut, unlockAdminByCode],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider.')
  }

  return context
}
