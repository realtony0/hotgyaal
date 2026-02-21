import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '../components/ProductCard'
import { QUICK_CATEGORY_LINKS } from '../constants/quickCategories'
import { useStoreCategories } from '../context/StoreCategoriesContext'
import { useStoreSettings } from '../context/StoreSettingsContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'

type HeroSlide = {
  id: string
  title: string
  imageUrl: string
  href: string
}

const FALLBACK_HERO_SLIDES: HeroSlide[] = [
  {
    id: 'fallback-1',
    title: 'Looks femme qui marquent vite',
    imageUrl: '/products/chrysalide-nocturne-01.webp',
    href: '/boutique',
  },
  {
    id: 'fallback-2',
    title: 'Tenues premium prêtes à commander',
    imageUrl: '/products/cape-celeste-01.webp',
    href: '/boutique?categorie=V%C3%AAtements%20Femmes',
  },
]

const HERO_ROTATION_MS = 4200

const clampWords = (value: string, limit: number) => {
  const words = value.trim().split(/\s+/)
  return words.slice(0, limit).join(' ')
}

export const HomePage = () => {
  const { settings } = useStoreSettings()
  const { categories, loading: loadingCategories } = useStoreCategories()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)

  useEffect(() => {
    const loadProducts = async () => {
      if (!isSupabaseConfigured) {
        setProducts([])
        setError(
          "Supabase n'est pas configure. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
        )
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
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger les produits depuis Supabase.',
        )
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

  const newDrops = useMemo(
    () => sortedProducts.filter((product) => product.is_new).slice(0, 8),
    [sortedProducts],
  )

  const bestSellers = useMemo(() => {
    const list = sortedProducts.filter((product) => product.is_best_seller)
    return (list.length ? list : sortedProducts).slice(0, 8)
  }, [sortedProducts])

  const heroSlides = useMemo<HeroSlide[]>(() => {
    const fromProducts = (newDrops.length ? newDrops : sortedProducts)
      .slice(0, 4)
      .map((product) => ({
        id: product.id,
        title: clampWords(product.name, 6),
        imageUrl:
          product.image_url ||
          'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
        href: `/produit/${product.slug}`,
      }))

    return fromProducts.length ? fromProducts : FALLBACK_HERO_SLIDES
  }, [newDrops, sortedProducts])

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

  const activeHero = heroSlides[activeHeroIndex] ?? heroSlides[0]

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active).slice(0, 6),
    [categories],
  )

  const loadingSkeletons = useMemo(
    () => Array.from({ length: 6 }, (_, index) => `skeleton-${index}`),
    [],
  )

  return (
    <div className="home-v2 home-v2--mobile-first">
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
              <p className="hero-convert__kicker">Collection du moment</p>
              <h1>{activeHero.title}</h1>

              <Link href={activeHero.href} className="button hero-convert__cta">
                Commander maintenant
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
            <span>Livraison partout au Sénégal 🇸🇳</span>
            <span>Paiement à la livraison disponible</span>
          </div>
        </div>
      </section>

      <section className="section section--quick-categories">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Shop rapide</p>
              <h2>Choisissez votre univers</h2>
            </div>
          </div>

          <div className="quick-categories" role="navigation" aria-label="Acces rapide categories">
            {QUICK_CATEGORY_LINKS.map((item) => (
              <Link key={item.label} href={item.href} className="quick-category-pill">
                <span className="quick-category-pill__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-v2">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Nouveautés 🔥</p>
              <h2>Les pièces à prendre vite</h2>
            </div>
            <Link href="/boutique">Tout voir</Link>
          </div>

          {loading ? (
            <div className="product-grid">
              {loadingSkeletons.map((key) => (
                <div key={key} className="product-skeleton-card" aria-hidden="true" />
              ))}
            </div>
          ) : null}

          {!loading && error ? <p className="error-text">{error}</p> : null}
          {!loading && !error && newDrops.length === 0 ? (
            <p>Aucun produit disponible pour le moment.</p>
          ) : null}

          {!loading && !error ? (
            <div className="product-grid stagger-grid">
              {newDrops.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section section-v2 section-v2--soft">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Tendance au Sénégal</p>
              <h2>Les plus commandés à Dakar</h2>
            </div>
            <Link href="/boutique">Voir la boutique</Link>
          </div>

          {loading ? (
            <div className="product-grid">
              {loadingSkeletons.map((key) => (
                <div key={`best-${key}`} className="product-skeleton-card" aria-hidden="true" />
              ))}
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="product-grid stagger-grid">
              {bestSellers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section section-v2 section-v2--categories">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Categories</p>
              <h2>Decouvrez nos univers</h2>
            </div>
            <Link href="/boutique">Catalogue complet</Link>
          </div>

          <div className="category-grid-v2">
            {activeCategories.map((category) => (
              <Link
                key={category.id}
                href={`/boutique?categorie=${encodeURIComponent(category.name)}`}
                className="category-card-v2"
              >
                <div className="category-card-v2__media">
                  <img
                    src={
                      category.image_url ||
                      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80'
                    }
                    alt={category.name}
                    loading="lazy"
                  />
                </div>
                <div className="category-card-v2__body">
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                </div>
              </Link>
            ))}
          </div>

          {loadingCategories ? <p>Chargement des categories...</p> : null}
        </div>
      </section>

      <section className="section section-v2 section-v2--service-note">
        <div className="container service-note-band">
          <p>{settings.hero_description}</p>
        </div>
      </section>
    </div>
  )
}
