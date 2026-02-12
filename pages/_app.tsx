import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { Layout } from '../src/components/Layout'
import { StoreCategoriesProvider } from '../src/context/StoreCategoriesContext'
import { AuthProvider } from '../src/context/AuthContext'
import { CartProvider } from '../src/context/CartContext'
import { StoreSettingsProvider } from '../src/context/StoreSettingsContext'
import '../src/index.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isAdminRoute = router.pathname.startsWith('/admin')

  return (
    <AuthProvider>
      <StoreSettingsProvider>
        <StoreCategoriesProvider>
          <CartProvider>
            {isAdminRoute ? (
              <Component {...pageProps} />
            ) : (
              <Layout>
                <Component {...pageProps} />
              </Layout>
            )}
          </CartProvider>
        </StoreCategoriesProvider>
      </StoreSettingsProvider>
    </AuthProvider>
  )
}
