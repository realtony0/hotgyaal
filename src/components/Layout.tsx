import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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
  { href: '/compte', label: 'Compte' },
  { href: '/faq', label: 'FAQ' },
]

const mobileLinks = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/boutique', label: 'Categories', icon: 'categories' },
  { href: '/panier', label: 'Panier', icon: 'cart' },
  { href: '/compte', label: 'Compte', icon: 'account' },
] as const

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hotgyaal.com'

const stripQuery = (path: string) => path.split('?')[0] || '/'
const readSearchFromPath = (path: string) => {
  const query = path.split('?')[1] ?? ''
  const params = new URLSearchParams(query)
  return (params.get('q') || params.get('recherche') || '').trim()
}

const normalizeChatNumber = (rawNumber: string) => {
  const digits = rawNumber.replace(/\D/g, '')

  if (digits.length === 9 && digits.startsWith('7')) {
    return `221${digits}`
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    const local = digits.slice(1)
    if (local.length === 9 && local.startsWith('7')) {
      return `221${local}`
    }
  }

  return digits
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
      description: 'Catalogue HOTGYAAL: mode, accessoires, beaute et plus.',
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

  if (pathname.startsWith('/compte')) {
    return {
      title: 'HOTGYAAL | Compte',
      description: 'Suivez vos commandes HOTGYAAL et votre espace client.',
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

type HeaderIconName = 'menu' | 'search' | 'cart' | 'close'

const HeaderIcon = ({ icon }: { icon: HeaderIconName }) => {
  if (icon === 'menu') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4 7.2h16" />
        <path d="M4 12h16" />
        <path d="M4 16.8h16" />
      </svg>
    )
  }

  if (icon === 'search') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="11" cy="11" r="6.4" />
        <path d="m16 16 4.2 4.2" />
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
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

const MobileNavIcon = ({ icon }: { icon: MobileIconName }) => {
  if (icon === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="m3 10.4 9-7.2 9 7.2" />
        <path d="M6.4 9.8V20h11.2V9.8" />
      </svg>
    )
  }

  if (icon === 'categories') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <rect x="3.8" y="4" width="6.5" height="6.5" rx="1.4" />
        <rect x="13.7" y="4" width="6.5" height="6.5" rx="1.4" />
        <rect x="3.8" y="13.7" width="6.5" height="6.5" rx="1.4" />
        <rect x="13.7" y="13.7" width="6.5" height="6.5" rx="1.4" />
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
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(() =>
    readSearchFromPath(router.asPath || '/'),
  )
  const [searchableProducts, setSearchableProducts] = useState<Product[]>([])
  const [shouldLoadSearchData, setShouldLoadSearchData] = useState(false)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0)

  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null)

  const seo = useMemo(() => {
    const currentPath = stripQuery(router.asPath || '/')
    return getSeoContent(currentPath)
  }, [router.asPath])

  const pageUrl = useMemo(() => `${SITE_URL}${router.asPath || '/'}`, [router.asPath])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active).slice(0, 8),
    [categories],
  )

  const orderChatNumber = useMemo(
    () =>
      normalizeChatNumber(
        settings.order_chat_number ||
          (
            process.env.NEXT_PUBLIC_ORDER_CHAT_NUMBER ??
            process.env.VITE_ORDER_CHAT_NUMBER ??
            '221770000000'
          ).toString(),
      ),
    [settings.order_chat_number],
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
    const syncFromRoute = (nextUrl: string) => {
      setSearchInput(readSearchFromPath(nextUrl))
      setIsMenuOpen(false)
      setIsSearchOpen(false)
    }

    router.events.on('routeChangeComplete', syncFromRoute)
    return () => {
      router.events.off('routeChangeComplete', syncFromRoute)
    }
  }, [router.events])

  useEffect(() => {
    if (!isSearchOpen) {
      return
    }

    const timer = window.setTimeout(() => {
      mobileSearchInputRef.current?.focus()
    }, 40)

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isSearchOpen])

  const openSearch = () => {
    if (!shouldLoadSearchData) {
      setShouldLoadSearchData(true)
    }

    setIsMenuOpen(false)
    setIsSearchOpen(true)
    setHighlightedSuggestionIndex(0)
  }

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
      const trendingProducts = baseProductSuggestions.slice(0, 8).map(({ product }) => ({
        key: `product-${product.id}`,
        label: product.name,
        hint: `${product.main_category} · ${product.sub_category}`,
        href: `/produit/${product.slug}`,
        kind: 'product' as const,
      }))

      const trendingCategories = activeCategories.slice(0, 4).map((category) => ({
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
      .slice(0, 7)
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
    setIsSearchOpen(false)
    setIsMenuOpen(false)
    void router.push(suggestion.href)
  }

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!searchSuggestions.length) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedSuggestionIndex((current) =>
        current + 1 >= searchSuggestions.length ? 0 : current + 1,
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedSuggestionIndex((current) =>
        current - 1 < 0 ? searchSuggestions.length - 1 : current - 1,
      )
      return
    }

    if (event.key === 'Enter') {
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

    if (!query) {
      setIsSearchOpen(false)
      void router.push('/boutique')
      return
    }

    setIsSearchOpen(false)
    void router.push({
      pathname: '/boutique',
      query: query ? { q: query } : {},
    })
  }

  return (
    <div className="app-shell app-shell--shopaliwa">
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
          <div className="container announcement-bar__content">{settings.announcement_text}</div>
        </div>

        <div className="header header--primary">
          <div className="container header__content header__content--shopaliwa">
            <div className="header__left">
              <button
                type="button"
                className="icon-button icon-button--header menu-toggle"
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-label="Ouvrir le menu"
                aria-expanded={isMenuOpen}
              >
                <span className="icon-button__glyph" aria-hidden="true">
                  <HeaderIcon icon="menu" />
                </span>
              </button>

              <nav className={`nav nav--drawer ${isMenuOpen ? 'is-open' : ''}`}>
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

            <div className="header__actions header__actions--shopaliwa">
              <button
                type="button"
                className="icon-button icon-button--header"
                onClick={openSearch}
                aria-label="Ouvrir la recherche"
              >
                <span className="icon-button__glyph" aria-hidden="true">
                  <HeaderIcon icon="search" />
                </span>
              </button>

              <Link
                href="/panier"
                className={
                  isPathActive('/panier', router.asPath || '/')
                    ? 'icon-button icon-button--header is-active'
                    : 'icon-button icon-button--header'
                }
                aria-label="Voir le panier"
              >
                <span className="icon-button__glyph" aria-hidden="true">
                  <HeaderIcon icon="cart" />
                </span>
                {totalItems > 0 ? <span className="cart-count">{totalItems}</span> : null}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {isSearchOpen ? (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Recherche produits">
          <div className="search-overlay__panel container">
            <form className="search-overlay__form" onSubmit={submitSearch}>
              <div className="search-overlay__field">
                <input
                  ref={mobileSearchInputRef}
                  type="search"
                  value={searchInput}
                  onChange={(event) => {
                    if (!shouldLoadSearchData) {
                      setShouldLoadSearchData(true)
                    }
                    setSearchInput(event.target.value)
                    setHighlightedSuggestionIndex(0)
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Recherche premium: robes, sacs, bijoux..."
                  aria-label="Recherche premium"
                />
              </div>

              <button
                type="button"
                className="icon-button icon-button--close"
                onClick={() => setIsSearchOpen(false)}
                aria-label="Fermer la recherche"
              >
                <span className="icon-button__glyph" aria-hidden="true">
                  <HeaderIcon icon="close" />
                </span>
              </button>
            </form>

            <p className="search-overlay__hint">Produits populaires et suggestions intelligentes</p>

            <div className="search-overlay__results">
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.key}
                  type="button"
                  className={
                    index === activeSuggestionIndex
                      ? 'search-overlay__item is-active'
                      : 'search-overlay__item'
                  }
                  onClick={() => selectSearchSuggestion(suggestion)}
                >
                  <span>{suggestion.label}</span>
                  <small>{suggestion.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <main>{children}</main>

      <a
        className="floating-whatsapp"
        href={`https://wa.me/${orderChatNumber}?text=${encodeURIComponent('Bonjour HOTGYAAL, je veux commander.')}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Contacter HOTGYAAL"
      >
        <span className="floating-whatsapp__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.03 3.23a8.68 8.68 0 0 0-7.5 13.05L3 21l4.85-1.52a8.68 8.68 0 1 0 4.18-16.25Zm0 15.72a7.01 7.01 0 0 1-3.58-.98l-.26-.15-2.88.9.9-2.8-.16-.28a7.02 7.02 0 1 1 5.98 3.31Zm3.85-5.26c-.21-.1-1.23-.61-1.42-.68-.19-.07-.33-.1-.47.1-.14.2-.54.68-.66.82-.12.14-.25.16-.46.05-.21-.1-.88-.32-1.67-1.02-.61-.54-1.03-1.21-1.15-1.41-.12-.2-.01-.31.09-.41.09-.09.21-.24.31-.35.1-.12.14-.2.21-.34.07-.14.03-.26-.02-.36-.05-.1-.47-1.13-.64-1.55-.17-.4-.35-.35-.47-.36h-.4c-.14 0-.36.05-.55.26-.19.21-.72.7-.72 1.71s.74 1.99.84 2.13c.1.14 1.45 2.22 3.52 3.11.49.21.88.34 1.17.44.49.16.94.14 1.29.09.39-.06 1.23-.5 1.4-.98.17-.48.17-.89.12-.98-.05-.09-.19-.14-.4-.24Z" />
          </svg>
        </span>
      </a>

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
                {isCart && totalItems > 0 ? <strong className="mobile-nav-count">{totalItems}</strong> : null}
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
                <Link href="/compte">Compte</Link>
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
              <p className="footer-note">Paiement a la livraison disponible</p>
            </div>
          </div>
        </div>

        <div className="container footer__bottom">
          <p>© {new Date().getFullYear()} HOTGYAAL - Tous droits reserves.</p>
        </div>
      </footer>
    </div>
  )
}
