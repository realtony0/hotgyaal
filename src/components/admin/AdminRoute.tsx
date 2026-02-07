import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../context/AuthContext'

type AdminRouteProps = {
  children: ReactNode
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const router = useRouter()
  const { isAdmin, loading } = useAuth()

  useEffect(() => {
    if (!loading && !isAdmin) {
      void router.replace('/admin/login')
    }
  }, [isAdmin, loading, router])

  if (loading) {
    return (
      <div className="center-page">
        <h1>Chargement...</h1>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
