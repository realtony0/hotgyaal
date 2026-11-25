import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { EmptyState } from '../components/EmptyState'
import { ProductCard } from '../components/ProductCard'
import { QUICK_CATEGORY_LINKS } from '../constants/quickCategories'
import {
  SPORT_FAMILIES,
  SPORT_SUB_CATEGORY,
  getSportFamily,
  isSportProduct,
} from '../constants/universes'
import { isSupabaseConfigured, resolveCatalogErrorMessage } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'

type ShopPageProps = {
  /** "sport" : la page /sport, limitee aux tenues de sport et a leurs familles. */
  preset?: 'sport'
}

type FilterLink = {
  key: string
  label: string
  href: string
  active: boolean
  count: number
}

const readParam = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? ''

const buildShopHref = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  const serialized = query.toString()
  return serialized ? `/boutique?${serialized}` : '/boutique'
}

const categoryFromHref = (href: string) => {
  const raw = href.split('categorie=')[1]
  return raw ? decodeURIComponent(raw).toLowerCase() : ''
}

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

  const visibleProducts = useMemo(() => {
    const query = searchQuery.toLowerCase()
    const sub = subQuery.toLowerCase()

    return scopedProducts.filter((product) => {
      if (isSportPage && activeFamily && getSportFamily(product)?.id !== activeFamily.id) {
        return false
      }

      if (sub && product.sub_category.toLowerCase() !== sub) {
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
  }, [activeFamily, isSportPage, scopedProducts, searchQuery, subQuery])

  /* Nombre de produits par categorie, pour les pastilles de premier niveau. */
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    // Une tenue de sport compte dans sa categorie (Vetements Femmes) et dans
    // le raccourci Tenues de sport : la pastille annonce ce que la page liste.
    sortedProducts.forEach((product) => {
      const key = product.main_category.trim().toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (isSportProduct(product)) {
        counts.set('/sport', (counts.get('/sport') ?? 0) + 1)
      }
    })
    return counts
  }, [sortedProducts])

  const primaryLinks = useMemo<FilterLink[]>(() => {
    const links = QUICK_CATEGORY_LINKS.map((item) => {
      const isSportLink = item.href === '/sport'
      const categoryName = categoryFromHref(item.href)
      const count = isSportLink
        ? (categoryCounts.get('/sport') ?? 0)
        : (categoryCounts.get(categoryName) ?? 0)

      return {
        key: item.href,
        label: item.label,
        href: item.href,
        active: isSportLink ? isSportPage : Boolean(categoryQuery) && categoryName === categoryQuery.toLowerCase(),
        count,
      }
    }).filter((link) => loadingProducts || link.count > 0)

    return [
      {
        key: 'all',
        label: 'Tout',
        href: '/boutique',
        active: !isSportPage && !categoryQuery,
        count: sortedProducts.length,
      },
      ...links,
    ]
  }, [categoryCounts, categoryQuery, isSportPage, loadingProducts, sortedProducts.length])

  /*
   * Pastilles de second niveau :
   * - sur /sport, les familles (ensembles, vestes, tops...) ;
   * - sur une categorie, ses sous-categories, "Tenues de sport" renvoyant
   *   vers sa page dediee.
   */
  const secondaryLinks = useMemo<FilterLink[]>(() => {
    if (isSportPage) {
      const families = SPORT_FAMILIES.map((family) => ({
        key: family.id,
        label: family.name,
        href: `/sport?type=${family.id}`,
        active: activeFamily?.id === family.id,
        count: scopedProducts.filter((product) => getSportFamily(product)?.id === family.id)
          .length,
      })).filter((family) => family.count > 0)

      if (!families.length) {
        return []
      }

      return [
        {
          key: 'all',
          label: 'Toutes les tenues',
          href: '/sport',
          active: !activeFamily,
          count: scopedProducts.length,
        },
        ...families,
      ]
    }

    if (!categoryQuery) {
      return []
    }

    const counts = new Map<string, number>()
    scopedProducts.forEach((product) => {
      const key = product.sub_category.trim()
      if (!key) return
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })

    const subs = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        key: name,
        label: name,
        href:
          name.toLowerCase() === SPORT_SUB_CATEGORY.toLowerCase()
            ? '/sport'
            : buildShopHref({ categorie: categoryQuery, sous: name, q: searchQuery }),
        active: subQuery.toLowerCase() === name.toLowerCase(),
        count,
      }))

    if (!subs.length) {
      return []
    }

    return [
      {
        key: 'all',
        label: 'Toutes',
        href: buildShopHref({ categorie: categoryQuery, q: searchQuery }),
        active: !subQuery,
        count: scopedProducts.length,
      },
      ...subs,
    ]
  }, [activeFamily, categoryQuery, isSportPage, scopedProducts, searchQuery, subQuery])

  const pageTitle = isSportPage
    ? activeFamily
      ? activeFamily.name
      : 'Tenues de sport'
    : searchQuery
      ? `Résultats pour « ${searchQuery} »`
      : subQuery || categoryQuery || 'Tout le catalogue'

  const resultsLabel = loadingProducts
    ? 'Chargement...'
    : `${visibleProducts.length} article${visibleProducts.length > 1 ? 's' : ''}`

  const loadingSkeletons = useMemo(
    () => Array.from({ length: 6 }, (_, index) => `shop-skeleton-${index}`),
    [],
  )

  const renderPills = (links: FilterLink[], label: string, extraClass = '') => (
    <div
      className={`quick-categories quick-categories--shop ${extraClass}`.trim()}
      role="navigation"
      aria-label={label}
    >
      {links.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={item.active ? 'quick-category-pill is-active' : 'quick-category-pill'}
          aria-current={item.active ? 'page' : undefined}
          scroll={false}
        >
          <span>{item.label}</span>
          {!loadingProducts ? (
            <small className="quick-category-pill__count">{item.count}</small>
          ) : null}
        </Link>
      ))}
    </div>
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

        {renderPills(primaryLinks, 'Catégories')}

        {secondaryLinks.length
          ? renderPills(
              secondaryLinks,
              isSportPage ? 'Familles de tenues de sport' : 'Sous-catégories',
              'quick-categories--secondary',
            )
          : null}

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
