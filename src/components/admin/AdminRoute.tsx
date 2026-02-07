import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

type AdminRouteProps = {
  children: ReactNode
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="center-page">
        <h1>Chargement...</h1>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}
