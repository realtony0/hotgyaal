import { AdminRoute } from '../../src/components/admin/AdminRoute'
import { AdminDashboardPage } from '../../src/pages/admin/AdminDashboardPage'

export default function AdminDashboard() {
  return (
    <AdminRoute>
      <AdminDashboardPage />
    </AdminRoute>
  )
}
