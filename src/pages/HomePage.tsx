import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ProductCard } from '../components/ProductCard'
import { useStoreCategories } from '../context/StoreCategoriesContext'
import { useStoreSettings } from '../context/StoreSettingsContext'
import { isSupabaseConfigured, resolveCatalogErrorMessage } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product, StoreCategory } from '../types'
import { groupProductsForStorefront } from '../utils/products'

type HeroSlide = {
  id: string
  title: string
  imageUrl: string
  href: string
}

type HomeCategory = {
  key: string
  name: string
  description: string
  href: string
  products: Product[]
  total: number
}

const HERO_ROTATION_MS = 4200
const PRODUCTS_PER_SECTION = 6
const NEW_DROPS_COUNT = 8

const clampWords = (value: string, limit: number) => {
  const words = value.trim().split(/\s+/)
  return words.slice(0, limit).join(' ')
}

/* Les populaires d'abord, puis les plus recentes. */
const popularFirst = (products: Product[]) => [
  ...products.filter((product) => product.is_best_seller),
  ...products.filter((product) => !product.is_best_seller),
]

const categoryHref = (category: StoreCategory) =>
  `/boutique?categorie=${encodeURIComponent(category.name)}`

export const HomePage = () => {
  const { settings } = useStoreSettings()
  const { categories } = useStoreCategories()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)

  useEffect(() => {
    const loadProducts = async () => {
      if (!isSupabaseConfigured) {
        setProducts([])
        setError(resolveCatalogErrorMessage('Supabase non configure'))
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const data = await listProducts()
        setProducts(groupProductsForStorefront(data))
        setError(null)
      } catch (loadError) {
        setProducts([])
        setError(resolveCatalogErrorMessage(loadError))
      } finally {
        setLoading(false)
      }
    }

    void loadProducts()
  }, [])

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [products],
  )

  const newDrops = useMemo(() => sortedProducts.slice(0, NEW_DROPS_COUNT), [sortedProducts])

  const heroSlides = useMemo<HeroSlide[]>(
    () =>
      (newDrops.length ? newDrops : sortedProducts).slice(0, 4).map((product) => ({
        id: product.id,
        title: clampWords(product.name, 6),
        imageUrl: product.image_url || '/placeholder-produit.svg',
        href: `/produit/${product.slug}`,
      })),
    [newDrops, sortedProducts],
  )

  useEffect(() => {
    if (heroSlides.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroSlides.length)
    }, HERO_ROTATION_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [heroSlides.length])

  useEffect(() => {
    if (activeHeroIndex < heroSlides.length) {
      return
    }

    setActiveHeroIndex(0)
  }, [activeHeroIndex, heroSlides.length])

  const activeHero = heroSlides[activeHeroIndex] ?? heroSlides[0] ?? null

  /*
   * Une rangee d'articles par categorie active qui a des produits. Les tenues
   * de sport restent dans "Vetements Femmes", leur categorie en base.
   */
  const homeCategories = useMemo<HomeCategory[]>(() => {
    const entries: HomeCategory[] = []

    categories
      .filter((category) => category.is_active)
      .forEach((category) => {
        const own = popularFirst(
          sortedProducts.filter(
            (product) =>
              product.main_category.trim().toLowerCase() ===
                category.name.trim().toLowerCase(),
          ),
        )

        if (!own.length) {
          return
        }

        entries.push({
          key: category.id,
          name: category.name,
          description: category.description,
          href: categoryHref(category),
          products: own.slice(0, PRODUCTS_PER_SECTION),
          total: own.length,
        })
      })

    return entries
  }, [categories, sortedProducts])

  const loadingSkeletons = useMemo(
    () => Array.from({ length: 6 }, (_, index) => `skeleton-${index}`),
    [],
  )

  return (
    <div className="home-v2 home-v2--mobile-first">
      {loading ? (
        <section className="hero-convert">
          <div className="container">
            <div className="hero-convert__placeholder" aria-hidden="true" />
          </div>
        </section>
      ) : null}

      {!loading && activeHero ? (
      <section className="hero-convert">
        <div className="container">
          <article className="hero-convert__slide" key={activeHero.id}>
            <img
              src={activeHero.imageUrl}
              alt={activeHero.title}
              loading="eager"
              fetchPriority="high"
            />

            <div className="hero-convert__overlay">
              <p className="hero-convert__kicker">Nouveautés</p>
              <h1>{activeHero.title}</h1>

              <Link href={activeHero.href} className="button hero-convert__cta">
                Découvrir
              </Link>
            </div>
          </article>

          <div className="hero-convert__dots" aria-label="Navigation du slider">
            {heroSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={index === activeHeroIndex ? 'is-active' : ''}
                onClick={() => setActiveHeroIndex(index)}
                aria-label={`Aller au slide ${index + 1}`}
              />
            ))}
          </div>

          <div className="hero-convert__meta">
            <span>Livraison partout au Sénégal</span>
          </div>
        </div>
      </section>
      ) : null}

      <section className="section section-v2">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Nouveautés</p>
              <h2>Les pièces à prendre vite</h2>
            </div>
            <Link href="/boutique">Tout voir</Link>
          </div>

          {loading ? (
            <div className="product-grid product-grid--home-compact">
              {loadingSkeletons.map((key) => (
                <div key={key} className="product-skeleton-card" aria-hidden="true" />
              ))}
            </div>
          ) : null}

          {!loading && error ? <p className="error-text">{error}</p> : null}
          {!loading && !error && newDrops.length === 0 ? (
            <EmptyState
              title="La collection arrive"
              description="Les premières pièces sont en cours de préparation. Écrivez-nous sur WhatsApp pour être prévenue dès leur mise en ligne."
              action={{ label: 'Nous contacter', href: '/contact' }}
            />
          ) : null}

          {!loading && !error ? (
            <div className="product-grid product-grid--home-compact stagger-grid">
              {newDrops.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {homeCategories.map((category, index) => (
        <section
          key={category.key}
          id={`categorie-${category.key}`}
          className={
            index % 2 === 0 ? 'section section-v2 section-v2--soft' : 'section section-v2'
          }
        >
          <div className="container">
            <div className="section__header section__header--v2">
              <div>
                <h2>{category.name}</h2>
                {category.description ? (
                  <p className="section__description">{category.description}</p>
                ) : null}
              </div>
              <Link href={category.href}>Tout voir ({category.total})</Link>
            </div>

            <div className="product-grid product-grid--home-compact stagger-grid">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="section section-v2 section-v2--service-note">
        <div className="container">
          <p className="service-note-lead">{settings.hero_description}</p>

          <ul className="service-promises">
            <li>
              <strong>Livraison partout au Sénégal</strong>
              <span>Dakar et régions, suivi assuré jusqu&apos;à la remise.</span>
            </li>
            <li>
              <strong>Conseil sur WhatsApp</strong>
              <span>Une question de taille ou de coloris ? On vous répond dans la journée.</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
