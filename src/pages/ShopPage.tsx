import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { ProductCard } from '../components/ProductCard'
import { isSupabaseConfigured } from '../lib/supabase'
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
        setErrorProducts(
          "Supabase n'est pas configure. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
        )
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
        setErrorProducts(
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger les produits depuis Supabase.',
        )
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

  const resultsLabel = loadingProducts
    ? 'Chargement des articles...'
    : `${visibleProducts.length} article${visibleProducts.length > 1 ? 's' : ''}`

  return (
    <section className="section shop-v2">
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

        {loadingProducts ? <p>Chargement des produits...</p> : null}
        {!loadingProducts && errorProducts ? <p className="error-text">{errorProducts}</p> : null}
        {!loadingProducts && !errorProducts && visibleProducts.length === 0 ? (
          <p>Aucun produit disponible.</p>
        ) : null}

        <div className="product-grid stagger-grid">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
