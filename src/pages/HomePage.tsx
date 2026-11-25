import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ProductCard } from '../components/ProductCard'
import { isSportProduct } from '../constants/universes'
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
  imageUrl: string
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
   * Tout l'accueil est organise par categorie : les tenues de sport (une
   * sous-categorie en base, mais 40 % du catalogue) ont leur propre entree,
   * puis chaque categorie active qui a des produits. Les produits de sport ne
   * reapparaissent pas dans "Vetements Femmes".
   */
  const homeCategories = useMemo<HomeCategory[]>(() => {
    const entries: HomeCategory[] = []

    const sport = popularFirst(sortedProducts.filter(isSportProduct))
    if (sport.length) {
      entries.push({
        key: 'sport',
        name: 'Tenues de sport',
        description: 'Ensembles, leggings, brassières, shorts et vestes.',
        href: '/sport',
        imageUrl: sport.find((product) => product.image_url)?.image_url || '/placeholder-produit.svg',
        products: sport.slice(0, PRODUCTS_PER_SECTION),
        total: sport.length,
      })
    }

    categories
      .filter((category) => category.is_active)
      .forEach((category) => {
        const own = popularFirst(
          sortedProducts.filter(
            (product) =>
              product.main_category.trim().toLowerCase() ===
                category.name.trim().toLowerCase() && !isSportProduct(product),
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
          // Les categories n'ont pas toutes une image en base : on emprunte
          // alors la photo d'un produit plutot que d'afficher un cadre vide.
          imageUrl:
            category.image_url ||
            own.find((product) => product.image_url)?.image_url ||
            '/placeholder-produit.svg',
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

      {homeCategories.length ? (
      <section className="section section--quick-categories">
        <div className="container">
          <div className="quick-categories" role="navigation" aria-label="Accès rapide aux catégories">
            {homeCategories.map((category) => (
              <Link key={category.key} href={category.href} className="quick-category-pill">
                <span>{category.name}</span>
                <small className="quick-category-pill__count">{category.total}</small>
              </Link>
            ))}
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

      {homeCategories.length ? (
      <section className="section section-v2 section-v2--categories">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Catégories</p>
              <h2>Découvrez nos univers</h2>
            </div>
            <Link href="/boutique">Catalogue complet</Link>
          </div>

          <div className="category-grid-v2">
            {homeCategories.map((category) => (
              <Link key={category.key} href={category.href} className="category-card-v2">
                <div className="category-card-v2__media">
                  <img src={category.imageUrl} alt={category.name} loading="lazy" />
                </div>
                <div className="category-card-v2__body">
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                  <span>{category.total} article{category.total > 1 ? 's' : ''}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      ) : null}

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
                <p className="eyebrow">Catégorie</p>
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
              <strong>Paiement à la livraison</strong>
              <span>Vous réglez à Dakar une fois votre commande entre les mains.</span>
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
