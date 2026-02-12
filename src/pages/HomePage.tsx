import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '../components/ProductCard'
import { useStoreCategories } from '../context/StoreCategoriesContext'
import { useStoreSettings } from '../context/StoreSettingsContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'

const CATEGORY_FALLBACK_TONES = [
  'linear-gradient(130deg, #2b1c23 0%, #734558 52%, #c0849c 100%)',
  'linear-gradient(130deg, #1e2732 0%, #3e5f7a 52%, #86a9c6 100%)',
  'linear-gradient(130deg, #2b2a20 0%, #6f653a 52%, #c1a96f 100%)',
]

export const HomePage = () => {
  const { settings } = useStoreSettings()
  const { categories, loading: loadingCategories } = useStoreCategories()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProducts = async () => {
      if (!isSupabaseConfigured) {
        setProducts([])
        setError(
          'Supabase n\'est pas configure. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
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

  const sections = useMemo(() => {
    const sortedProducts = [...products].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
    )
    const used = new Set<string>()
    const sectionSize = Math.max(
      1,
      Math.min(8, Math.ceil(Math.max(sortedProducts.length, 1) / 3)),
    )

    const pickUnique = (
      source: Product[],
      count: number,
      withFallback = true,
    ): Product[] => {
      const selected: Product[] = []
      for (const product of source) {
        const key = product.slug || product.id
        if (used.has(key)) {
          continue
        }

        used.add(key)
        selected.push(product)

        if (selected.length === count) {
          break
        }
      }

      if (withFallback && selected.length < count) {
        for (const product of sortedProducts) {
          const key = product.slug || product.id
          if (used.has(key)) {
            continue
          }

          used.add(key)
          selected.push(product)

          if (selected.length === count) {
            break
          }
        }
      }

      return selected
    }

    const softCollection = pickUnique(sortedProducts, sectionSize, false)
    const newIn = pickUnique(
      sortedProducts.filter((product) => product.is_new),
      sectionSize,
    )
    const favorites = pickUnique(
      sortedProducts.filter((product) => product.is_best_seller),
      sectionSize,
    )

    return { softCollection, newIn, favorites }
  }, [products])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    products.forEach((product) => {
      counts.set(product.main_category, (counts.get(product.main_category) ?? 0) + 1)
    })
    return counts
  }, [products])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  )

  const heroImage = products[0]?.image_url ?? '/products/chrysalide-nocturne-01.webp'
  return (
    <div>
      <section className="hero hero--shopliwa">
        <div className="container hero__grid">
          <div className="hero__text">
            <p className="eyebrow">{settings.hero_eyebrow}</p>
            <h1>{settings.hero_title}</h1>
            <p>{settings.hero_description}</p>
            <div className="hero__actions">
              <Link href="/boutique" className="button">
                Decouvrir la boutique
              </Link>
              <a href="#new-in" className="button button--ghost">
                Nouveautés
              </a>
            </div>
          </div>
          <div className="hero__media">
            <img src={heroImage} alt="HOTGYAAL collection" fetchPriority="high" />
          </div>
        </div>
      </section>

      <section className="section" id="soft-collection">
        <div className="container">
          <div className="section__header">
            <div>
              <p className="eyebrow">Collection Signature</p>
              <h2>Collection signature</h2>
            </div>
            <Link href="/boutique">Tout voir</Link>
          </div>

          <div className="product-grid stagger-grid">
            {sections.softCollection.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="new-in">
        <div className="container">
          <div className="section__header">
            <div>
              <p className="eyebrow">Nouveautés</p>
              <h2>Les nouveautés</h2>
            </div>
            <Link href="/boutique">Voir tout</Link>
          </div>

          {loading ? <p>Chargement des nouveautés...</p> : null}
          {!loading && error ? <p className="error-text">{error}</p> : null}
          {!loading && !error && sections.newIn.length === 0 ? (
            <p>Aucun produit disponible pour le moment.</p>
          ) : null}

          <div className="product-grid stagger-grid">
            {sections.newIn.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="categories">
        <div className="container">
          <div className="section__header">
            <div>
              <p className="eyebrow">Shoppez par catégorie</p>
              <h2>Nos univers</h2>
            </div>
            <Link href="/boutique">Voir tout</Link>
          </div>

          <div className="category-grid category-grid--media">
            {activeCategories.map((category, index) => {
              const categoryCount = categoryCounts.get(category.name) ?? 0
              const style = category.image_url
                ? {
                    backgroundImage: `url(${category.image_url})`,
                    color: '#ffffff',
                  }
                : {
                    background: CATEGORY_FALLBACK_TONES[index % CATEGORY_FALLBACK_TONES.length],
                    color: 'white',
                  }

              return (
                <Link
                  key={category.slug}
                  href={`/boutique?categorie=${encodeURIComponent(category.name)}`}
                  className="category-card category-card--media"
                  style={style}
                >
                  {category.image_url ? <div className="category-card__overlay" /> : null}
                  <div className="category-card__content">
                    <h3>{category.name}</h3>
                    <p>{category.description}</p>
                    <div className="category-card__tags">
                      {category.subcategories.slice(0, 3).map((subCategory) => (
                        <span key={subCategory} className="category-tag">
                          {subCategory}
                        </span>
                      ))}
                    </div>
                    <div className="category-card__meta">
                      <span>
                        {categoryCount > 0
                          ? `${categoryCount} article${categoryCount > 1 ? 's' : ''}`
                          : 'Arrivages en cours'}
                      </span>
                      <span>{category.subcategories.length} sous-categories</span>
                    </div>
                    <span className="category-card__link">Voir la categorie</span>
                  </div>
                </Link>
              )
            })}
          </div>

          {loadingCategories ? (
            <p>Chargement des categories...</p>
          ) : null}
        </div>
      </section>

      <section className="section" id="favorites">
        <div className="container">
          <div className="section__header">
            <div>
              <p className="eyebrow">Favoris</p>
              <h2>Les incontournables</h2>
            </div>
            <Link href="/boutique">Découvrir</Link>
          </div>

          <div className="product-grid stagger-grid">
            {sections.favorites.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section newsletter">
        <div className="container newsletter__content">
          <div>
            <p className="eyebrow">Restez proche</p>
            <h2>Abonnez-vous pour recevoir les nouveautés</h2>
            <p>News, drops exclusifs et offres HOTGYAAL.</p>
          </div>
          <form className="newsletter__form">
            <input type="email" placeholder="Votre email" required />
            <button className="button" type="submit">
              S'inscrire
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
