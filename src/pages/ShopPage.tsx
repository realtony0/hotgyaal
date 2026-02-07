import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import {
  CATEGORY_TREE,
  getSubcategoriesByMainCategory,
} from '../constants/categories'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { LOCAL_PRODUCTS } from '../data/localProducts'
import { groupProductsForStorefront } from '../utils/products'

type SortOption = 'newest' | 'price-asc' | 'price-desc'

type ShopCategoryVisual = {
  image: string
  note: string
}

const SHOP_CATEGORY_VISUALS: Record<string, ShopCategoryVisual> = {
  'Vêtements Femmes': {
    image: '/categories/women-fashion.webp',
    note: 'Mode feminine',
  },
  'Bijoux & Accessoires': {
    image: '/categories/jewelry-accessories.webp',
    note: 'Accessoires premium',
  },
  Chaussures: {
    image: '/categories/shoes.webp',
    note: 'Chaussures tendance',
  },
  'Téléphone & Accessoires': {
    image: '/categories/phone-accessories.webp',
    note: 'Univers tech',
  },
  'Sacs & Bagages': {
    image: '/categories/bags-luggage.webp',
    note: 'Sacs et voyage',
  },
  'Sous-vêtements & Pyjamas': {
    image: '/categories/sleepwear.webp',
    note: 'Confort quotidien',
  },
  'Home & Living': {
    image: '/categories/home-living.webp',
    note: 'Maison et deco',
  },
}

export const ShopPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initialCategory = searchParams.get('categorie') ?? ''
  const initialSubCategory = searchParams.get('sous_categorie') ?? ''

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubCategory)
  const [sort, setSort] = useState<SortOption>('newest')

  useEffect(() => {
    setSelectedCategory(initialCategory)
    setSelectedSubCategory(initialSubCategory)
  }, [initialCategory, initialSubCategory])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setProducts(groupProductsForStorefront(LOCAL_PRODUCTS))
      setLoading(false)
      return
    }

    const loadProducts = async () => {
      try {
        setLoading(true)
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

  const availableSubcategories = useMemo(
    () => getSubcategoriesByMainCategory(selectedCategory),
    [selectedCategory],
  )

  const categoryStats = useMemo(() => {
    const stats = new Map<
      string,
      { total: number; subCounts: Map<string, number> }
    >()

    products.forEach((product) => {
      const category = product.main_category
      const subCategory = product.sub_category
      const current =
        stats.get(category) ?? { total: 0, subCounts: new Map<string, number>() }
      current.total += 1
      current.subCounts.set(subCategory, (current.subCounts.get(subCategory) ?? 0) + 1)
      stats.set(category, current)
    })

    return CATEGORY_TREE.map((category) => {
      const current = stats.get(category.name)
      const topSubcategories = category.subcategories
        .map((subCategory) => ({
          name: subCategory,
          count: current?.subCounts.get(subCategory) ?? 0,
        }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)

      return {
        ...category,
        total: current?.total ?? 0,
        subCounts: current?.subCounts ?? new Map<string, number>(),
        topSubcategories,
      }
    })
  }, [products])

  const selectedCategoryStats = useMemo(
    () => categoryStats.find((category) => category.name === selectedCategory),
    [categoryStats, selectedCategory],
  )

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    const filtered = products.filter((product) => {
      const matchesCategory =
        !selectedCategory || product.main_category === selectedCategory
      const matchesSubCategory =
        !selectedSubCategory || product.sub_category === selectedSubCategory
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesSubCategory && matchesSearch
    })

    return filtered.sort((a, b) => {
      if (sort === 'price-asc') {
        return a.price - b.price
      }

      if (sort === 'price-desc') {
        return b.price - a.price
      }

      return +new Date(b.created_at) - +new Date(a.created_at)
    })
  }, [products, search, selectedCategory, selectedSubCategory, sort])

  const applyCategoryFilter = (category: string) => {
    setSelectedCategory(category)
    setSelectedSubCategory('')

    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (category) {
        next.set('categorie', category)
      } else {
        next.delete('categorie')
      }
      next.delete('sous_categorie')
      return next
    })
  }

  const applySubCategoryFilter = (subCategory: string) => {
    setSelectedSubCategory(subCategory)

    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (subCategory) {
        next.set('sous_categorie', subCategory)
      } else {
        next.delete('sous_categorie')
      }
      return next
    })
  }

  const resetFilters = () => {
    setSearch('')
    setSelectedCategory('')
    setSelectedSubCategory('')
    setSort('newest')
    setSearchParams(new URLSearchParams())
  }

  return (
    <section className="section">
      <div className="container">
        <div className="shop-hero">
          <div>
            <p className="eyebrow">Boutique HOTGYAAL</p>
            <h1>Selection boutique</h1>
            <p>
              Explorez nos categories et filtrez rapidement par univers et
              sous-categorie. Produits importes depuis la Chine pour le marche
              senegalais.
            </p>
          </div>
          <div className="shop-hero__count">
            <strong>{filteredProducts.length}</strong>
            <span>articles visibles</span>
          </div>
        </div>

        <div className="shop-category-browser">
          <button
            type="button"
            className={
              !selectedCategory
                ? 'shop-category-card shop-category-card--all is-active'
                : 'shop-category-card shop-category-card--all'
            }
            onClick={() => applyCategoryFilter('')}
          >
            <div className="shop-category-card__media shop-category-card__media--all">
              <span>{products.length} produit(s)</span>
            </div>

            <div className="shop-category-card__body">
              <h3>Toutes les categories</h3>
              <p>Vue globale du catalogue HOTGYAAL</p>
              <div className="shop-category-card__subs">
                <span>Multi-categories</span>
                <span>Nouveautés</span>
                <span>Best sellers</span>
              </div>
            </div>
          </button>

          {categoryStats.map((category) => {
            const visual = SHOP_CATEGORY_VISUALS[category.name]
            const isActive = selectedCategory === category.name
            const hasProducts = category.total > 0
            const categoryImage = visual?.image ?? '/categories/women-fashion.webp'

            return (
              <button
                type="button"
                key={category.slug}
                className={
                  [
                    'shop-category-card',
                    isActive ? 'is-active' : '',
                    !hasProducts ? 'is-disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                onClick={() => applyCategoryFilter(category.name)}
                disabled={!hasProducts}
              >
                <div
                  className="shop-category-card__media"
                  style={{ backgroundImage: `url(${categoryImage})` }}
                >
                  <span>{category.total} produit(s)</span>
                </div>

                <div className="shop-category-card__body">
                  <h3>{category.name}</h3>
                  <p>{visual?.note ?? category.description}</p>
                  <div className="shop-category-card__subs">
                    {(category.topSubcategories.length
                      ? category.topSubcategories.map((sub) => `${sub.name} (${sub.count})`)
                      : category.subcategories
                          .slice(0, 3)
                          .map(
                            (subCategory) =>
                              `${subCategory} (${category.subCounts.get(subCategory) ?? 0})`,
                          )
                    ).map((subLabel) => (
                      <span key={subLabel}>{subLabel}</span>
                    ))}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="filters-card filters-card--shop">
          <div className="shop-filters-head">
            <p>
              Categorie active:{' '}
              <strong>{selectedCategory || 'Toutes les categories'}</strong>
            </p>
            {selectedSubCategory ? <p>Sous-categorie: {selectedSubCategory}</p> : null}
          </div>

          <div className="filters-grid">
            <label>
              Rechercher
              <input
                type="search"
                placeholder="Nom produit..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label>
              Trier
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
              >
                <option value="newest">Plus récents</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
              </select>
            </label>
          </div>

          {selectedCategory && availableSubcategories.length > 0 ? (
            <div className="shop-subcategory-pills">
              {availableSubcategories.map((subCategory) => {
                const subCategoryCount =
                  selectedCategoryStats?.subCounts.get(subCategory) ?? 0
                const isDisabled = subCategoryCount === 0
                const isActive = subCategory === selectedSubCategory

                return (
                  <button
                    type="button"
                    key={subCategory}
                    className={
                      [
                        'chip',
                        isActive ? 'chip--active' : '',
                        isDisabled ? 'chip--disabled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                    onClick={() =>
                      applySubCategoryFilter(isActive ? '' : subCategory)
                    }
                    disabled={isDisabled}
                  >
                    {`${subCategory} (${subCategoryCount})`}
                  </button>
                )
              })}
            </div>
          ) : null}

          {(selectedCategory || selectedSubCategory || search.trim()) && (
            <div className="shop-active-filters">
              {selectedCategory ? <span className="active-pill">{selectedCategory}</span> : null}
              {selectedSubCategory ? (
                <span className="active-pill">{selectedSubCategory}</span>
              ) : null}
              {search.trim() ? <span className="active-pill">Recherche: {search.trim()}</span> : null}
              <button type="button" className="chip chip--clear" onClick={resetFilters}>
                Reinitialiser
              </button>
            </div>
          )}
        </div>

        {loading ? <p>Chargement des produits...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error && filteredProducts.length === 0 ? (
          <p>Aucun produit ne correspond à vos filtres.</p>
        ) : null}

        <div className="product-grid stagger-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {!isSupabaseConfigured ? (
          <p className="banner-warning">Mode catalogue local activé.</p>
        ) : null}
      </div>
    </section>
  )
}
