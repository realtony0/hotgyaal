import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { EmptyState } from '../components/EmptyState'
import { ProductCard } from '../components/ProductCard'
import {
  SPORT_FAMILIES,
  getSportFamily,
  isSportProduct,
} from '../constants/universes'
import { isSupabaseConfigured, resolveCatalogErrorMessage } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'
import { buildSearchEntries, searchCatalogueWithFallback } from '../utils/search'

type ShopPageProps = {
  /** "sport" : la page /sport, limitee aux tenues de sport et a leurs familles. */
  preset?: 'sport'
}

const readParam = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? ''

export const ShopPage = ({ preset }: ShopPageProps) => {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [errorProducts, setErrorProducts] = useState<string | null>(null)

  const isSportPage = preset === 'sport'

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

  const searchQuery = router.isReady ? readParam(router.query.q || router.query.recherche) : ''
  const categoryQuery = router.isReady && !isSportPage ? readParam(router.query.categorie) : ''
  const subQuery = router.isReady && !isSportPage ? readParam(router.query.sous) : ''
  const familyQuery = router.isReady && isSportPage ? readParam(router.query.type) : ''

  const activeFamily = SPORT_FAMILIES.find((family) => family.id === familyQuery) ?? null

  // Perimetre de la page avant sous-categorie et recherche : sert aussi aux
  // compteurs des pastilles.
  const scopedProducts = useMemo(() => {
    if (isSportPage) {
      return sortedProducts.filter(isSportProduct)
    }

    if (!categoryQuery) {
      return sortedProducts
    }

    return sortedProducts.filter(
      (product) => product.main_category.toLowerCase() === categoryQuery.toLowerCase(),
    )
  }, [categoryQuery, isSportPage, sortedProducts])

  const { visibleProducts, usedQuery } = useMemo(() => {
    const sub = subQuery.toLowerCase()

    const filtered = scopedProducts.filter((product) => {
      if (isSportPage && activeFamily && getSportFamily(product)?.id !== activeFamily.id) {
        return false
      }

      return !sub || product.sub_category.toLowerCase() === sub
    })

    // Meme moteur que la barre de recherche : resultats classes par pertinence,
    // et repli sur les premiers mots si la recherche complete ne donne rien.
    if (!searchQuery) {
      return { visibleProducts: filtered, usedQuery: '' }
    }

    const search = searchCatalogueWithFallback(buildSearchEntries(filtered), searchQuery)
    return { visibleProducts: search.results, usedQuery: search.usedQuery }
  }, [activeFamily, isSportPage, scopedProducts, searchQuery, subQuery])

  const pageTitle = isSportPage
    ? activeFamily
      ? activeFamily.name
      : 'Tenues de sport'
    : searchQuery
      ? `Résultats pour « ${usedQuery || searchQuery} »`
      : subQuery || categoryQuery || 'Tout le catalogue'

  const isPartialSearch = Boolean(searchQuery && usedQuery && usedQuery !== searchQuery)

  const resultsLabel = loadingProducts
    ? 'Chargement...'
    : `${visibleProducts.length} article${visibleProducts.length > 1 ? 's' : ''}${
        isPartialSearch ? ` · aucun article ne correspond à « ${searchQuery} »` : ''
      }`

  const loadingSkeletons = useMemo(
    () => Array.from({ length: 6 }, (_, index) => `shop-skeleton-${index}`),
    [],
  )

  return (
    <section className="section shop-v2 shop-v2--mobile-first">
      <div className="container">
        <div className="section__header section__header--v2 shop-header">
          <div>
            <p className="eyebrow">{isSportPage ? 'Catégorie' : searchQuery ? 'Recherche' : 'Boutique'}</p>
            <h1>{pageTitle}</h1>
            <p className="shop-header__count" role="status" aria-live="polite">
              {resultsLabel}
            </p>
          </div>
          {isSportPage || categoryQuery ? <Link href="/boutique">Tout le catalogue</Link> : null}
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
              description={
                isSportPage
                  ? 'Essayez une autre famille de tenues, ou parcourez toute la catégorie.'
                  : "Essayez une autre catégorie, ou parcourez l'ensemble du catalogue."
              }
              action={
                isSportPage
                  ? { label: 'Toutes les tenues de sport', href: '/sport' }
                  : { label: 'Voir tout le catalogue', href: '/boutique' }
              }
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
