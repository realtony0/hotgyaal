import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCart } from '../context/CartContext'
import { useStoreCategories } from '../context/StoreCategoriesContext'
import { useStoreSettings } from '../context/StoreSettingsContext'

const primaryLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/boutique', label: 'Catalogue' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
]

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hotgyaal.com'

const stripQuery = (path: string) => path.split('?')[0] || '/'

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
        'Catalogue HOTGYAAL: mode, accessoires, beauté et plus, en XOF pour le marché sénégalais.',
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
      description: 'Contact HOTGYAAL, vente au Sénégal, sourcing depuis la Chine.',
    }
  }

  return {
    title: 'HOTGYAAL | Fashion & Lifestyle',
    description:
      'HOTGYAAL propose mode, accessoires, beauté et lifestyle pour le marché sénégalais, avec sourcing direct en Chine.',
  }
}

type LayoutProps = {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const router = useRouter()
  const { settings } = useStoreSettings()
  const { categories } = useStoreCategories()
  const { totalItems } = useCart()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(() => {
    const query = (router.asPath || '').split('?')[1] ?? ''
    const params = new URLSearchParams(query)
    return (params.get('q') || '').trim()
  })

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

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchInput.trim()
    setIsMenuOpen(false)

    void router.push({
      pathname: '/boutique',
      query: query ? { q: query } : {},
    })
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
                <form className="nav-search" onSubmit={submitSearch}>
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Rechercher un article"
                    aria-label="Rechercher un article"
                  />
                  <button type="submit">OK</button>
                </form>

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
              <form className="header-search" onSubmit={submitSearch}>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Recherche"
                  aria-label="Recherche"
                />
                <button type="submit">Chercher</button>
              </form>

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
        <Link
          href="/"
          className={
            isPathActive('/', router.asPath || '/')
              ? 'mobile-nav-link is-active'
              : 'mobile-nav-link'
          }
        >
          <span>Accueil</span>
        </Link>
        <Link
          href="/boutique"
          className={
            isPathActive('/boutique', router.asPath || '/')
              ? 'mobile-nav-link is-active'
              : 'mobile-nav-link'
          }
        >
          <span>Shop</span>
        </Link>
        <Link
          href="/panier"
          className={
            isPathActive('/panier', router.asPath || '/')
              ? 'mobile-nav-link is-active'
              : 'mobile-nav-link'
          }
        >
          <span>Panier</span>
          {totalItems > 0 ? <strong className="mobile-nav-count">{totalItems}</strong> : null}
        </Link>
        <Link
          href="/contact"
          className={
            isPathActive('/contact', router.asPath || '/')
              ? 'mobile-nav-link is-active'
              : 'mobile-nav-link'
          }
        >
          <span>Contact</span>
        </Link>
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
              <p className="footer-title">HOTGYAAL</p>
              <p className="footer-note">Sourcing produits en Chine</p>
              <p className="footer-note">Distribution au Sénégal</p>
              <p className="footer-note">Commandes et tarifs en XOF</p>
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
