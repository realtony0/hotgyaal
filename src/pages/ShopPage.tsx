import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { EmptyState } from '../components/EmptyState'
import { ProductCard } from '../components/ProductCard'
import { QUICK_CATEGORY_LINKS } from '../constants/quickCategories'
import { isSupabaseConfigured, resolveCatalogErrorMessage } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'

export const ShopPage = () => {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [errorProducts, setErrorProducts] = useState<string | null>(null)

  useEffect(() => {
    const loadProducts = async () => {
      if (!isSupabaseConfigured) {
        setProducts([])
        setErrorProducts(resolveCatalogErrorMessage('Supabase non configure'))
        setLoadingProducts(false)
        return
      }

      try {
        setLoadingProducts(true)
        const data = await listProducts()
        setProducts(groupProductsForStorefront(data))
        setErrorProducts(null)
      } catch (loadError) {
        setProducts([])
        setErrorProducts(resolveCatalogErrorMessage(loadError))
      } finally {
        setLoadingProducts(false)
      }
    }

    void loadProducts()
  }, [])

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [products],
  )

  const searchQuery = useMemo(() => {
    if (!router.isReady) {
      return ''
    }

    const value = router.query.q || router.query.recherche
    return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim()
  }, [router.isReady, router.query])

  const categoryQuery = useMemo(() => {
    if (!router.isReady) {
      return ''
    }

    const value = router.query.categorie
    return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim()
  }, [router.isReady, router.query])

  const visibleProducts = useMemo(() => {
    const query = searchQuery.toLowerCase()
    const category = categoryQuery.toLowerCase()

    return sortedProducts.filter((product) => {
      const matchesCategory = !category || product.main_category.toLowerCase() === category
      if (!matchesCategory) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        product.name,
        product.description,
        product.main_category,
        product.sub_category,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [categoryQuery, searchQuery, sortedProducts])

  const resultsLabel = loadingProducts ? 'Chargement...' : 'Catalogue'

  const loadingSkeletons = useMemo(
    () => Array.from({ length: 6 }, (_, index) => `shop-skeleton-${index}`),
    [],
  )

  return (
    <section className="section shop-v2 shop-v2--mobile-first">
      <div className="container">
        <div className="shop-mobile-summary" role="status" aria-live="polite">
          <p>{resultsLabel}</p>

          {searchQuery || categoryQuery ? (
            <div className="shop-mobile-summary__chips">
              {categoryQuery ? <span className="active-pill">{categoryQuery}</span> : null}
              {searchQuery ? <span className="active-pill">Recherche: {searchQuery}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="quick-categories quick-categories--shop" role="navigation" aria-label="Filtres rapides">
          {QUICK_CATEGORY_LINKS.map((item) => (
            <Link key={`shop-${item.label}`} href={item.href} className="quick-category-pill">
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {loadingProducts ? (
          <div className="product-grid product-grid--shop-mobile">
            {loadingSkeletons.map((key) => (
              <div key={key} className="product-skeleton-card" aria-hidden="true" />
            ))}
          </div>
        ) : null}

        {!loadingProducts && errorProducts ? <p className="error-text">{errorProducts}</p> : null}
        {!loadingProducts && !errorProducts && visibleProducts.length === 0 ? (
          products.length ? (
            <EmptyState
              title="Aucun article ne correspond"
              description="Essayez une autre catégorie, ou parcourez l'ensemble du catalogue."
              action={{ label: 'Voir tout le catalogue', href: '/boutique' }}
            />
          ) : (
            <EmptyState
              title="La collection arrive"
              description="Les premières pièces sont en cours de préparation. Revenez très vite, ou écrivez-nous pour être prévenue en avant-première."
              action={{ label: 'Nous contacter', href: '/contact' }}
            />
          )
        ) : null}

        {!loadingProducts && !errorProducts ? (
          <div className="product-grid product-grid--shop-mobile stagger-grid">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
