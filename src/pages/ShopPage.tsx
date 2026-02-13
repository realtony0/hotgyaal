import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '../components/ProductCard'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'

export const ShopPage = () => {
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

  return (
    <section className="section shop-v2">
      <div className="container">
        {loadingProducts ? <p>Chargement des produits...</p> : null}
        {!loadingProducts && errorProducts ? <p className="error-text">{errorProducts}</p> : null}
        {!loadingProducts && !errorProducts && sortedProducts.length === 0 ? (
          <p>Aucun produit disponible.</p>
        ) : null}

        <div className="product-grid stagger-grid">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
