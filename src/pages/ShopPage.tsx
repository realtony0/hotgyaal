import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import { ProductCard } from '../components/ProductCard'
import { useStoreCategories } from '../context/StoreCategoriesContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'

type SortOption = 'newest' | 'price-asc' | 'price-desc'

const readQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? '' : value ?? ''

export const ShopPage = () => {
  const router = useRouter()
  const { categories, loading: loadingCategories, error: categoriesError } =
    useStoreCategories()

  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [errorProducts, setErrorProducts] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    setSearch(readQueryValue(router.query.q || router.query.recherche))
    setSelectedCategory(readQueryValue(router.query.categorie))
    setSelectedSubCategory(readQueryValue(router.query.sous_categorie))
  }, [router.isReady, router.query])

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

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  )

  const categoryCountMap = useMemo(() => {
    const map = new Map<string, number>()
    products.forEach((product) => {
      map.set(product.main_category, (map.get(product.main_category) ?? 0) + 1)
    })
    return map
  }, [products])

  const subCategoryCountMap = useMemo(() => {
    const map = new Map<string, number>()
    products.forEach((product) => {
      const key = `${product.main_category}|||${product.sub_category}`
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return map
  }, [products])

  const availableSubcategories = useMemo(() => {
    if (!selectedCategory) {
      return []
    }

    const category = activeCategories.find((entry) => entry.name === selectedCategory)
    return category?.subcategories ?? []
  }, [activeCategories, selectedCategory])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    const filtered = products.filter((product) => {
      const matchesCategory =
        !selectedCategory || product.main_category === selectedCategory
      const matchesSubCategory =
        !selectedSubCategory || product.sub_category === selectedSubCategory
      const matchesSearch =
        !normalizedSearch ||
        [
          product.name,
          product.description,
          product.main_category,
          product.sub_category,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

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

  const pushQuery = (patch: Record<string, string | null>) => {
    if (!router.isReady) {
      return
    }

    const nextQuery: Record<string, string> = {}

    Object.entries(router.query).forEach(([key, value]) => {
      const parsed = readQueryValue(value)
      if (parsed) {
        nextQuery[key] = parsed
      }
    })

    Object.entries(patch).forEach(([key, value]) => {
      if (value && value.trim()) {
        nextQuery[key] = value
      } else {
        delete nextQuery[key]
      }
    })

    void router.replace(
      {
        pathname: '/boutique',
        query: nextQuery,
      },
      undefined,
      { shallow: true, scroll: false },
    )
  }

  const handleApplySearch = () => {
    pushQuery({ q: search.trim() || null })
  }

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleApplySearch()
  }

  const handlePickCategory = (name: string) => {
    setSelectedCategory(name)
    setSelectedSubCategory('')
    pushQuery({
      categorie: name || null,
      sous_categorie: null,
    })
  }

  const handlePickSubCategory = (name: string) => {
    const isSame = selectedSubCategory === name
    setSelectedSubCategory(isSame ? '' : name)
    pushQuery({ sous_categorie: isSame ? null : name })
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedCategory('')
    setSelectedSubCategory('')
    setSort('newest')
    setIsFiltersOpen(false)
    if (router.isReady) {
      void router.replace('/boutique', undefined, { shallow: true, scroll: false })
    }
  }

  const hasActiveFilters = Boolean(
    search.trim() || selectedCategory || selectedSubCategory,
  )

  return (
    <section className="section shop-v2">
      <div className="container">
        <div className="shop-hero-v2">
          <div>
            <p className="eyebrow">Catalogue HOTGYAAL</p>
            <h1>Shop premium pour le marche senegalais</h1>
            <p>
              Recherchez rapidement vos articles, puis filtrez par categorie ou sous-categorie.
            </p>
          </div>
          <div className="shop-hero-v2__count">
            <strong>{filteredProducts.length}</strong>
            <span>article(s)</span>
          </div>
        </div>

        <form className="shop-search-v2" onSubmit={handleSearchSubmit}>
          <label className="shop-search-v2__search">
            Recherche produit
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, categorie, sous-categorie"
            />
          </label>

          <label className="shop-search-v2__sort">
            Tri
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
            >
              <option value="newest">Plus recents</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix decroissant</option>
            </select>
          </label>

          <div className="shop-search-v2__actions">
            <button type="submit" className="button">
              Rechercher
            </button>
            <button type="button" className="button button--ghost" onClick={clearFilters}>
              Reinitialiser
            </button>
          </div>
        </form>

        <div className="shop-category-grid-v2">
          <button
            type="button"
            onClick={() => handlePickCategory('')}
            className={!selectedCategory ? 'shop-cat-chip is-active' : 'shop-cat-chip'}
          >
            Tout ({products.length})
          </button>

          {activeCategories.map((category) => {
            const count = categoryCountMap.get(category.name) ?? 0
            const isActive = selectedCategory === category.name

            return (
              <button
                key={category.id}
                type="button"
                disabled={count === 0}
                onClick={() => handlePickCategory(category.name)}
                className={
                  [
                    'shop-cat-chip',
                    isActive ? 'is-active' : '',
                    count === 0 ? 'is-disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                {category.name} ({count})
              </button>
            )
          })}
        </div>

        <div className="shop-mobile-actions">
          <button
            type="button"
            className="mobile-filter-toggle"
            onClick={() => setIsFiltersOpen((current) => !current)}
            aria-expanded={isFiltersOpen}
            aria-controls="shop-v2-filters"
          >
            {isFiltersOpen ? 'Masquer filtres' : 'Afficher filtres'}
          </button>
        </div>

        <div
          id="shop-v2-filters"
          className={[
            'shop-filters-v2',
            isFiltersOpen ? 'is-open' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="shop-filters-v2__head">
            <p>
              Categorie: <strong>{selectedCategory || 'Toutes'}</strong>
            </p>
            {selectedSubCategory ? (
              <p>
                Sous-categorie: <strong>{selectedSubCategory}</strong>
              </p>
            ) : null}
          </div>

          {availableSubcategories.length ? (
            <div className="shop-sub-pills-v2">
              {availableSubcategories.map((subCategory) => {
                const key = `${selectedCategory}|||${subCategory}`
                const count = subCategoryCountMap.get(key) ?? 0
                const isActive = selectedSubCategory === subCategory

                return (
                  <button
                    key={subCategory}
                    type="button"
                    disabled={count === 0}
                    className={
                      [
                        'chip',
                        isActive ? 'chip--active' : '',
                        count === 0 ? 'chip--disabled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                    onClick={() => handlePickSubCategory(subCategory)}
                  >
                    {subCategory} ({count})
                  </button>
                )
              })}
            </div>
          ) : null}

          {hasActiveFilters ? (
            <div className="shop-active-filters-v2">
              {selectedCategory ? <span className="active-pill">{selectedCategory}</span> : null}
              {selectedSubCategory ? <span className="active-pill">{selectedSubCategory}</span> : null}
              {search.trim() ? <span className="active-pill">Recherche: {search.trim()}</span> : null}
            </div>
          ) : null}
        </div>

        {loadingCategories ? <p>Chargement des categories...</p> : null}
        {categoriesError ? <p className="error-text">{categoriesError}</p> : null}

        {loadingProducts ? <p>Chargement des produits...</p> : null}
        {!loadingProducts && errorProducts ? <p className="error-text">{errorProducts}</p> : null}
        {!loadingProducts && !errorProducts && filteredProducts.length === 0 ? (
          <p>Aucun produit ne correspond à vos filtres.</p>
        ) : null}

        <div className="shop-results-head">
          <p>
            <strong>{filteredProducts.length}</strong> article(s) affiche(s)
          </p>
          {hasActiveFilters ? (
            <button type="button" className="button button--ghost" onClick={clearFilters}>
              Effacer les filtres
            </button>
          ) : null}
        </div>

        <div className="product-grid stagger-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
