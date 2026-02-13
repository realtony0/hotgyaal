import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '../components/ProductCard'
import { useStoreCategories } from '../context/StoreCategoriesContext'
import { useStoreSettings } from '../context/StoreSettingsContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'

const FALLBACK_HERO_MEDIA = [
  '/products/chrysalide-nocturne-01.webp',
  '/products/cape-celeste-01.webp',
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

  const bestSellers = useMemo(
    () => sortedProducts.filter((product) => product.is_best_seller).slice(0, 8),
    [sortedProducts],
  )

  const editorChoice = useMemo(
    () => (newDrops.length ? newDrops : sortedProducts).slice(0, 4),
    [newDrops, sortedProducts],
  )

  const heroImages = useMemo(() => {
    const fromCatalog = sortedProducts
      .map((product) => product.image_url)
      .filter((value): value is string => Boolean(value))
      .slice(0, 2)

    if (fromCatalog.length === 2) {
      return fromCatalog
    }

    return FALLBACK_HERO_MEDIA
  }, [sortedProducts])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active).slice(0, 6),
    [categories],
  )

  return (
    <div className="home-v2">
      <section className="hero-v2">
        <div className="container hero-v2__grid">
          <div className="hero-v2__content">
            <p className="hero-v2__eyebrow">{settings.hero_eyebrow}</p>
            <h1>{settings.hero_title}</h1>
            <p>{settings.hero_description}</p>
            <div className="hero-v2__actions">
              <Link href="/boutique" className="button">
                Explorer le catalogue
              </Link>
              <Link href="/boutique?categorie=V%C3%AAtements%20Femmes" className="button button--ghost">
                Focus mode femme
              </Link>
            </div>
          </div>

          <div className="hero-v2__visual">
            <div className="hero-v2__tile hero-v2__tile--large">
              <img src={heroImages[0]} alt="Collection HOTGYAAL" fetchPriority="high" />
            </div>
            <div className="hero-v2__tile hero-v2__tile--small">
              <img src={heroImages[1]} alt="Nouveautes HOTGYAAL" fetchPriority="high" />
            </div>
          </div>
        </div>
      </section>

      <section className="section section-v2">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Nouveautes</p>
              <h2>Les dernieres arrives</h2>
            </div>
            <Link href="/boutique">Tout voir</Link>
          </div>

          {loading ? <p>Chargement des nouveautés...</p> : null}
          {!loading && error ? <p className="error-text">{error}</p> : null}
          {!loading && !error && newDrops.length === 0 ? (
            <p>Aucun produit disponible pour le moment.</p>
          ) : null}

          <div className="product-grid stagger-grid">
            {newDrops.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-v2 section-v2--soft">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Selection HOTGYAAL</p>
              <h2>Best sellers</h2>
            </div>
            <Link href="/boutique">Voir toute la boutique</Link>
          </div>

          <div className="product-grid stagger-grid">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-v2">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Univers</p>
              <h2>Shoppez par categorie</h2>
            </div>
            <Link href="/boutique">Acceder au catalogue</Link>
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
                  <span>{category.subcategories.slice(0, 2).join(' · ')}</span>
                </div>
              </Link>
            ))}
          </div>

          {loadingCategories ? <p>Chargement des categories...</p> : null}
        </div>
      </section>

      <section className="section section-v2 section-v2--import">
        <div className="container import-band">
          <div>
            <p className="eyebrow">Import Export</p>
            <h2>Une selection pensee pour le Senegal</h2>
            <p>
              HOTGYAAL source ses produits en Chine puis organise la distribution locale
              avec un suivi commande clair.
            </p>
          </div>
          <div className="import-band__grid">
            <article>
              <strong>01</strong>
              <p>Sourcing des tendances et verification qualite.</p>
            </article>
            <article>
              <strong>02</strong>
              <p>Mise en catalogue avec photos, tailles et couleurs.</p>
            </article>
            <article>
              <strong>03</strong>
              <p>Validation panier puis confirmation de commande.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-v2">
        <div className="container">
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Lookbook</p>
              <h2>Selection editoriale</h2>
            </div>
            <Link href="/boutique">Acheter maintenant</Link>
          </div>

          <div className="editor-grid">
            {editorChoice.map((product) => (
              <Link key={product.id} href={`/produit/${product.slug}`} className="editor-card">
                <img
                  src={
                    product.image_url ||
                    'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=80'
                  }
                  alt={product.name}
                  loading="lazy"
                />
                <div className="editor-card__overlay">
                  <p>{product.main_category}</p>
                  <h3>{product.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
