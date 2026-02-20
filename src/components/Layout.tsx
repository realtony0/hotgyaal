import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCart } from '../context/CartContext'
import { useStoreCategories } from '../context/StoreCategoriesContext'
import { useStoreSettings } from '../context/StoreSettingsContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { groupProductsForStorefront } from '../utils/products'

const primaryLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/boutique', label: 'Catalogue' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
]

const mobileLinks = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/boutique', label: 'Shop', icon: 'shop' },
  { href: '/panier', label: 'Panier', icon: 'cart' },
  { href: '/contact', label: 'Contact', icon: 'contact' },
] as const

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hotgyaal.com'

const stripQuery = (path: string) => path.split('?')[0] || '/'
const readSearchFromPath = (path: string) => {
  const query = path.split('?')[1] ?? ''
  const params = new URLSearchParams(query)
  return (params.get('q') || params.get('recherche') || '').trim()
}

const isPathActive = (href: string, asPath: string) => {
  if (href.includes('?')) {
    return asPath === href
  }

  const currentPath = stripQuery(asPath)
  if (href === '/') {
    return currentPath === '/'
  }

  return currentPath === href || currentPath.startsWith(`${href}/`)
}

const getSeoContent = (pathname: string) => {
  if (pathname.startsWith('/boutique')) {
    return {
      title: 'HOTGYAAL | Boutique',
      description:
        'Catalogue HOTGYAAL: mode, accessoires, beaute et plus.',
    }
  }

  if (pathname.startsWith('/produit/')) {
    return {
      title: 'HOTGYAAL | Produit',
      description:
        'Fiche produit HOTGYAAL avec photos, couleurs, tailles et ajout rapide au panier.',
    }
  }

  if (pathname.startsWith('/panier')) {
    return {
      title: 'HOTGYAAL | Panier',
      description:
        'Finalisez votre panier HOTGYAAL puis validez la commande via confirmation directe.',
    }
  }

  if (pathname.startsWith('/contact')) {
    return {
      title: 'HOTGYAAL | Contact',
      description: 'Contact HOTGYAAL, sourcing et import-export.',
    }
  }

  return {
    title: 'HOTGYAAL | Fashion & Lifestyle',
    description:
      'HOTGYAAL propose mode, accessoires, beaute et lifestyle, avec sourcing direct en Chine.',
  }
}

type LayoutProps = {
  children: ReactNode
}

type SearchSuggestion = {
  key: string
  label: string
  hint: string
  href: string
  kind: 'product' | 'category' | 'query'
}

type MobileIconName = (typeof mobileLinks)[number]['icon']

const MobileNavIcon = ({ icon }: { icon: MobileIconName }) => {
  if (icon === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="m3 10.4 9-7.2 9 7.2" />
        <path d="M6.4 9.8V20h11.2V9.8" />
      </svg>
    )
  }

  if (icon === 'shop') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4.5 7.2h15l-1.2 12.3H5.7z" />
        <path d="M8.2 7.2a3.8 3.8 0 0 1 7.6 0" />
      </svg>
    )
  }

  if (icon === 'cart') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M3.2 4.5h2.6l2.2 10.4h9.6l2-7.1H7.2" />
        <circle cx="10.4" cy="18.5" r="1.35" />
        <circle cx="17.1" cy="18.5" r="1.35" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4.2 19.1a7.8 7.8 0 1 1 15.6 0" />
      <circle cx="12" cy="8.1" r="3.1" />
    </svg>
  )
}

export const Layout = ({ children }: LayoutProps) => {
  const router = useRouter()
  const { settings } = useStoreSettings()
  const { categories } = useStoreCategories()
  const { totalItems } = useCart()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(() =>
    readSearchFromPath(router.asPath || '/'),
  )
  const [searchableProducts, setSearchableProducts] = useState<Product[]>([])
  const [shouldLoadSearchData, setShouldLoadSearchData] = useState(false)
  const [isSearchSuggestionsOpen, setIsSearchSuggestionsOpen] = useState(false)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0)
  const desktopSearchRef = useRef<HTMLDivElement | null>(null)
  const mobileSearchRef = useRef<HTMLDivElement | null>(null)

  const seo = useMemo(() => {
    const currentPath = stripQuery(router.asPath || '/')
    return getSeoContent(currentPath)
  }, [router.asPath])

  const pageUrl = useMemo(
    () => `${SITE_URL}${router.asPath || '/'}`,
    [router.asPath],
  )

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active).slice(0, 8),
    [categories],
  )

  useEffect(() => {
    if (!isSupabaseConfigured || !shouldLoadSearchData) {
      return
    }

    let ignore = false

    const loadSearchableProducts = async () => {
      try {
        const data = await listProducts()
        if (ignore) {
          return
        }

        setSearchableProducts(groupProductsForStorefront(data).slice(0, 200))
      } catch {
        if (!ignore) {
          setSearchableProducts([])
        }
      }
    }

    void loadSearchableProducts()

    return () => {
      ignore = true
    }
  }, [shouldLoadSearchData])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null

      const isInDesktopSearch = Boolean(
        target && desktopSearchRef.current?.contains(target),
      )
      const isInMobileSearch = Boolean(target && mobileSearchRef.current?.contains(target))

      if (!isInDesktopSearch && !isInMobileSearch) {
        setIsSearchSuggestionsOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const syncSearchFromRoute = (nextUrl: string) => {
      setSearchInput(readSearchFromPath(nextUrl))
      setIsSearchSuggestionsOpen(false)
    }

    router.events.on('routeChangeComplete', syncSearchFromRoute)
    return () => {
      router.events.off('routeChangeComplete', syncSearchFromRoute)
    }
  }, [router.events])

  const searchSuggestions = useMemo<SearchSuggestion[]>(() => {
    const query = searchInput.trim().toLowerCase()

    const baseProductSuggestions = searchableProducts.map((product) => {
      const name = product.name.toLowerCase()
      const mainCategory = product.main_category.toLowerCase()
      const subCategory = product.sub_category.toLowerCase()
      const description = product.description.toLowerCase()

      if (!query) {
        return { product, score: 0 }
      }

      let score = 0

      if (name === query) {
        score += 140
      }

      if (name.startsWith(query)) {
        score += 110
      }

      if (name.includes(query)) {
        score += 80
      }

      if (mainCategory.includes(query) || subCategory.includes(query)) {
        score += 45
      }

      if (description.includes(query)) {
        score += 20
      }

      return { product, score }
    })

    if (!query) {
      const trendingProducts = baseProductSuggestions
        .slice(0, 4)
        .map(({ product }) => ({
          key: `product-${product.id}`,
          label: product.name,
          hint: `${product.main_category} · ${product.sub_category}`,
          href: `/produit/${product.slug}`,
          kind: 'product' as const,
        }))

      const trendingCategories = activeCategories.slice(0, 3).map((category) => ({
        key: `category-${category.id}`,
        label: category.name,
        hint: 'Categorie',
        href: `/boutique?categorie=${encodeURIComponent(category.name)}`,
        kind: 'category' as const,
      }))

      return [...trendingProducts, ...trendingCategories]
    }

    const productMatches = baseProductSuggestions
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ product }) => ({
        key: `product-${product.id}`,
        label: product.name,
        hint: `${product.main_category} · ${product.sub_category}`,
        href: `/produit/${product.slug}`,
        kind: 'product' as const,
      }))

    const categoryMatches = activeCategories
      .filter((category) => category.name.toLowerCase().includes(query))
      .slice(0, 3)
      .map((category) => ({
        key: `category-${category.id}`,
        label: category.name,
        hint: 'Categorie',
        href: `/boutique?categorie=${encodeURIComponent(category.name)}`,
        kind: 'category' as const,
      }))

    const combined = [...productMatches, ...categoryMatches]

    if (combined.length === 0) {
      return [
        {
          key: `query-${query}`,
          label: `Rechercher "${searchInput.trim()}"`,
          hint: 'Voir les resultats',
          href: `/boutique?q=${encodeURIComponent(searchInput.trim())}`,
          kind: 'query',
        },
      ]
    }

    return combined
  }, [activeCategories, searchInput, searchableProducts])

  const activeSuggestionIndex =
    highlightedSuggestionIndex < searchSuggestions.length
      ? highlightedSuggestionIndex
      : 0

  const selectSearchSuggestion = (suggestion: SearchSuggestion) => {
    setSearchInput(suggestion.label)
    setIsSearchSuggestionsOpen(false)
    setIsMenuOpen(false)
    void router.push(suggestion.href)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!searchSuggestions.length) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsSearchSuggestionsOpen(true)
      setHighlightedSuggestionIndex((current) =>
        current + 1 >= searchSuggestions.length ? 0 : current + 1,
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsSearchSuggestionsOpen(true)
      setHighlightedSuggestionIndex((current) =>
        current - 1 < 0 ? searchSuggestions.length - 1 : current - 1,
      )
      return
    }

    if (event.key === 'Escape') {
      setIsSearchSuggestionsOpen(false)
      return
    }

    if (event.key === 'Enter' && isSearchSuggestionsOpen) {
      const selected = searchSuggestions[activeSuggestionIndex]
      if (selected) {
        event.preventDefault()
        selectSearchSuggestion(selected)
      }
    }
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchInput.trim()
    setIsMenuOpen(false)
    setIsSearchSuggestionsOpen(false)

    if (!query) {
      void router.push('/boutique')
      return
    }

    void router.push({
      pathname: '/boutique',
      query: query ? { q: query } : {},
    })
  }

  const showSearchSuggestions =
    isSearchSuggestionsOpen && searchSuggestions.length > 0

  const renderSearchSuggestions = () => {
    if (!showSearchSuggestions) {
      return null
    }

    return (
      <div className="smart-search__panel">
        {searchSuggestions.map((suggestion, index) => (
          <button
            key={suggestion.key}
            type="button"
            className={
              index === activeSuggestionIndex
                ? 'smart-search__item is-active'
                : 'smart-search__item'
            }
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectSearchSuggestion(suggestion)}
          >
            <span>{suggestion.label}</span>
            <small>{suggestion.hint}</small>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Head>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <header className="site-header">
        <div className="announcement-bar">
          <div className="container announcement-bar__content">
            {settings.announcement_text}
          </div>
        </div>

        <div className="header header--primary">
          <div className="container header__content">
            <div className="header__left">
              <button
                type="button"
                className="menu-toggle"
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-label="Ouvrir le menu"
                aria-expanded={isMenuOpen}
              >
                Menu
              </button>

              <nav className={`nav ${isMenuOpen ? 'is-open' : ''}`}>
                {primaryLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      isPathActive(link.href, router.asPath || '/')
                        ? 'nav-link is-active'
                        : 'nav-link'
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <Link href="/" className="brand brand--center">
              HOTGYAAL
            </Link>

            <div className="header__actions">
              <div className="header-search-wrap smart-search" ref={desktopSearchRef}>
                <form className="header-search" onSubmit={submitSearch}>
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => {
                      if (!shouldLoadSearchData) {
                        setShouldLoadSearchData(true)
                      }
                      setSearchInput(event.target.value)
                      setIsSearchSuggestionsOpen(true)
                      setHighlightedSuggestionIndex(0)
                    }}
                    onFocus={() => {
                      if (!shouldLoadSearchData) {
                        setShouldLoadSearchData(true)
                      }
                      setIsSearchSuggestionsOpen(true)
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Recherche intelligente"
                    aria-label="Recherche"
                  />
                  <button type="submit">Chercher</button>
                </form>
                {renderSearchSuggestions()}
              </div>

              <Link
                href="/panier"
                className={
                  isPathActive('/panier', router.asPath || '/')
                    ? 'nav-link is-active'
                    : 'nav-link'
                }
                onClick={() => setIsMenuOpen(false)}
              >
                Panier
                {totalItems > 0 ? <span className="cart-count">{totalItems}</span> : null}
              </Link>
            </div>
          </div>

          <div className="container header__mobile-search" ref={mobileSearchRef}>
            <div className="mobile-search-bar smart-search">
              <form className="mobile-search-bar__form" onSubmit={submitSearch}>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => {
                    if (!shouldLoadSearchData) {
                      setShouldLoadSearchData(true)
                    }
                    setSearchInput(event.target.value)
                    setIsSearchSuggestionsOpen(true)
                    setHighlightedSuggestionIndex(0)
                  }}
                  onFocus={() => {
                    if (!shouldLoadSearchData) {
                      setShouldLoadSearchData(true)
                    }
                    setIsSearchSuggestionsOpen(true)
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Rechercher produits, categories..."
                  aria-label="Recherche mobile"
                />
                <button type="submit">OK</button>
              </form>
              {renderSearchSuggestions()}
            </div>
          </div>
        </div>

        <div className="header header--secondary">
          <div className="container category-strip" role="navigation" aria-label="Catégories">
            <Link href="/boutique" className="category-strip__link">
              Tout voir
            </Link>
            {activeCategories.map((category) => (
              <Link
                key={category.id}
                href={`/boutique?categorie=${encodeURIComponent(category.name)}`}
                className="category-strip__link"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        {mobileLinks.map((link) => {
          const isActive = isPathActive(link.href, router.asPath || '/')
          const isCart = link.href === '/panier'

          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? 'mobile-nav-link is-active' : 'mobile-nav-link'}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="mobile-nav-link__icon-wrap">
                <span className="mobile-nav-link__icon" aria-hidden="true">
                  <MobileNavIcon icon={link.icon} />
                </span>
                {isCart && totalItems > 0 ? (
                  <strong className="mobile-nav-count">{totalItems}</strong>
                ) : null}
              </span>
              <span className="mobile-nav-link__label">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      <footer className="footer">
        <div className="container footer__content footer__content--grid">
          <div className="footer-brand">
            <strong>HOTGYAAL</strong>
            <p>{settings.footer_blurb}</p>
            <div className="footer-contact-inline">
              <span>{settings.contact_phone}</span>
              <span>{settings.contact_email}</span>
            </div>
          </div>

          <div className="footer-columns">
            <div className="footer-column">
              <p className="footer-title">Navigation</p>
              <nav className="footer-links">
                <Link href="/">Accueil</Link>
                <Link href="/boutique">Catalogue</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/faq">FAQ</Link>
                <Link href="/cgv-retours">Conditions</Link>
                <Link href="/confidentialite">Confidentialité</Link>
              </nav>
            </div>

            <div className="footer-column">
              <p className="footer-title">Infos boutique</p>
              <p className="footer-note">Selection mode, beaute et accessoires</p>
              <p className="footer-note">Produits importes depuis la Chine</p>
              <p className="footer-note">Disponibles selon les collections en cours</p>
            </div>
          </div>
        </div>

        <div className="container footer__bottom">
          <p>© {new Date().getFullYear()} HOTGYAAL - Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  )
}
