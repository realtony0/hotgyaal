import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AdminRoute } from './components/admin/AdminRoute'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { CartPage } from './pages/CartPage'
import { ContactPage } from './pages/ContactPage'
import { FaqPage } from './pages/FaqPage'
import { HomePage } from './pages/HomePage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ProductPage } from './pages/ProductPage'
import { ShopPage } from './pages/ShopPage'
import { TermsPage } from './pages/TermsPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/boutique" element={<ShopPage />} />
              <Route path="/produit/:slug" element={<ProductPage />} />
              <Route path="/panier" element={<CartPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/cgv-retours" element={<TermsPage />} />
              <Route path="/confidentialite" element={<PrivacyPage />} />
              <Route
                path="*"
                element={
                  <section className="section">
                    <div className="container">
                      <h1>Page introuvable</h1>
                    </div>
                  </section>
                }
              />
            </Route>

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
