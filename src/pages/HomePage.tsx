import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_TREE } from '../constants/categories'
import { ProductCard } from '../components/ProductCard'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { LOCAL_PRODUCTS } from '../data/localProducts'
import { groupProductsForStorefront } from '../utils/products'

type CategoryVisual = {
  note: string
  image?: string
  tone?: string
  textColor?: string
  highlights?: string[]
}

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  'Vêtements Femmes': {
    image: '/categories/women-fashion.webp',
    note: 'Mode et tenues tendance',
    textColor: '#ffffff',
    highlights: ['Robes', 'Tops', 'Vestes', 'Sport'],
  },
  'Bijoux & Accessoires': {
    image: '/categories/jewelry-accessories.webp',
    note: 'Bijoux, lunettes et accessoires',
    textColor: '#ffffff',
    highlights: ['Colliers', 'Boucles d’oreilles', 'Sacs'],
  },
  Chaussures: {
    image: '/categories/shoes.webp',
    note: 'Baskets, bottes, sandales et plus',
    textColor: '#ffffff',
    highlights: ['Baskets', 'Talons', 'Sandales & Crocs'],
  },
  'Téléphone & Accessoires': {
    image: '/categories/phone-accessories.webp',
    note: 'Coques, chargeurs, ecouteurs, iPad',
    textColor: '#ffffff',
    highlights: ['Coques', 'Chargeurs', 'Power banks'],
  },
  'Sacs & Bagages': {
    image: '/categories/bags-luggage.webp',
    note: 'Sacs a main, valises et voyage',
    textColor: '#ffffff',
    highlights: ['Sacs a main', 'Valises', 'Bandouliere'],
  },
  'Sous-vêtements & Pyjamas': {
    image: '/categories/sleepwear.webp',
    note: 'Sous-vetements et pyjamas confort',
    textColor: '#ffffff',
    highlights: ['Lingerie', 'Nuisettes', 'Pyjamas'],
  },
  'Home & Living': {
    image: '/categories/home-living.webp',
    note: 'Decoration et maison',
    textColor: '#ffffff',
    highlights: ['Decoration murale', 'Mobilier', 'Cuisine'],
  },
}

export const HomePage = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setProducts(groupProductsForStorefront(LOCAL_PRODUCTS))
      setLoading(false)
      return
    }

    const loadProducts = async () => {
      try {
        const data = await listProducts()
        setProducts(groupProductsForStorefront(data))
        setError(null)
      } catch {
        setProducts(groupProductsForStorefront(LOCAL_PRODUCTS))
        setError(null)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
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

  const heroImage = products[0]?.image_url ?? '/products/chrysalide-nocturne-01.webp'
  return (
    <div>
      <section className="hero hero--shopliwa">
        <div className="container hero__grid">
          <div className="hero__text">
            <p className="eyebrow">Mode Femme & Accessoires</p>
            <h1>Vetements, accessoires et chaussures tendance au Senegal.</h1>
            <p>
              HOTGYAAL met en avant la mode feminine: robes, tops, ensembles,
              sacs, bijoux et chaussures. Les produits sont selectionnes en
              Chine puis proposes au marche senegalais.
            </p>
            <div className="hero__actions">
              <Link to="/boutique" className="button">
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
            <Link to="/boutique">Tout voir</Link>
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
            <Link to="/boutique">Voir tout</Link>
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
            <Link to="/boutique">Voir tout</Link>
          </div>

          <div className="category-grid category-grid--media">
            {CATEGORY_TREE.map((category) => {
              const visual = CATEGORY_VISUALS[category.name]
              const categoryCount = categoryCounts.get(category.name) ?? 0
              const style = visual?.image
                ? {
                    backgroundImage: `url(${visual.image})`,
                    color: visual.textColor ?? '#ffffff',
                  }
                : visual?.tone
                  ? {
                      background: visual.tone,
                      color: visual.textColor ?? 'white',
                    }
                  : undefined

              return (
                <Link
                  key={category.slug}
                  to={`/boutique?categorie=${encodeURIComponent(category.name)}`}
                  className="category-card category-card--media"
                  style={style}
                >
                  {visual?.image ? <div className="category-card__overlay" /> : null}
                  <div className="category-card__content">
                    <h3>{category.name}</h3>
                    <p>{visual?.note ?? category.description}</p>
                    <div className="category-card__tags">
                      {(visual?.highlights ?? category.subcategories.slice(0, 3)).map(
                        (subCategory) => (
                          <span key={subCategory} className="category-tag">
                            {subCategory}
                          </span>
                        ),
                      )}
                    </div>
                    <div className="category-card__meta">
                      <span>
                        {categoryCount > 0
                          ? `${categoryCount} article${categoryCount > 1 ? 's' : ''}`
                          : 'Arrivages en cours'}
                      </span>
                      <span>{category.subcategories.length} sous-catégories</span>
                    </div>
                    <span className="category-card__link">Voir la categorie</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section" id="favorites">
        <div className="container">
          <div className="section__header">
            <div>
              <p className="eyebrow">Favoris</p>
              <h2>Les incontournables</h2>
            </div>
            <Link to="/boutique">Découvrir</Link>
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

      {!isSupabaseConfigured ? (
        <section className="section">
          <div className="container banner-warning">
            <p>Mode catalogue local activé. Connectez Supabase pour les commandes.</p>
          </div>
        </section>
      ) : null}
    </div>
  )
}
