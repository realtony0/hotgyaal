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
  const [loading] = useState(false)
  // L'etat admin est tranche par le serveur (cookie signe httpOnly), jamais
  // par un drapeau que le navigateur pourrait poser lui-meme.
  const [isCodeAdmin, setIsCodeAdmin] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/admin/session', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : { isAdmin: false }))
      .then((data: { isAdmin?: boolean }) => {
        if (active) {
          setIsCodeAdmin(Boolean(data.isAdmin))
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

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
      try {
        const { data } = await client.auth.getSession()
        if (!isMounted) {
          return
        }

        setSession(data.session)

        if (data.session?.user) {
          await syncProfile(data.session.user.id)
        }
      } catch (error) {
        console.error('Impossible de restaurer la session Supabase', error)
        if (isMounted) {
          setSession(null)
          setProfile(null)
        }
      }
    }

    void initialize()

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
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(data?.error || 'Code incorrect.')
    }

    setIsCodeAdmin(true)
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Déconnexion Supabase impossible', error.message)
      }
    }

    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => undefined)

    setIsCodeAdmin(false)
    setProfile(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: isCodeAdmin,
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
