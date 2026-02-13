import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCart } from '../context/CartContext'
import { useStoreSettings } from '../context/StoreSettingsContext'

const storefrontLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/boutique', label: 'Boutique' },
  { href: '/boutique?categorie=V%C3%AAtements%20Femmes&sous_categorie=Robes', label: 'Robes' },
  { href: '/boutique?categorie=Beaut%C3%A9', label: 'Beauté' },
  { href: '/boutique?categorie=Bijoux%20%26%20Accessoires', label: 'Accessoires' },
  { href: '/boutique?categorie=Chaussures', label: 'Chaussures' },
]

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hotgyaal.com'

const getSeoContent = (pathname: string) => {
  if (pathname.startsWith('/boutique')) {
    return {
      title: 'Boutique Multi-Categories',
      description:
        'Decouvrez les categories HOTGYAAL: mode, accessoires, chaussures, tech, sacs et maison en XOF.',
    }
  }

  if (pathname.startsWith('/produit/')) {
    return {
      title: 'Fiche Produit HOTGYAAL',
      description:
        'Consultez les details produit, couleurs disponibles et photos avant ajout au panier.',
    }
  }

  if (pathname.startsWith('/panier')) {
    return {
      title: 'Panier et Finalisation',
      description:
        'Finalisez votre commande HOTGYAAL avec choix transport et confirmation rapide.',
    }
  }

  if (pathname.startsWith('/contact')) {
    return {
      title: 'Contact HOTGYAAL',
      description:
        'Service client HOTGYAAL au Senegal. Vente locale avec sourcing en Chine.',
    }
  }

  if (pathname.startsWith('/faq')) {
    return {
      title: 'FAQ HOTGYAAL',
      description:
        'Reponses sur la commande, les options transport et la disponibilite des articles.',
    }
  }

  if (pathname.startsWith('/cgv-retours')) {
    return {
      title: 'Conditions de Vente',
      description:
        'Conditions commerciales HOTGYAAL: validation de commande, transport et reclamations.',
    }
  }

  if (pathname.startsWith('/confidentialite')) {
    return {
      title: 'Confidentialite HOTGYAAL',
      description:
        'Politique de confidentialite HOTGYAAL sur la collecte et la protection des donnees clients.',
    }
  }

  return {
    title: 'HOTGYAAL - Boutique Multi-Categories',
    description:
      'HOTGYAAL: boutique multi-categories au Senegal avec importation depuis la Chine et panier complet en XOF.',
  }
}

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

type LayoutProps = {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [quickSearch, setQuickSearch] = useState(() => {
    const query = (router.asPath || '').split('?')[1] ?? ''
    const params = new URLSearchParams(query)
    return (params.get('q') || params.get('recherche') || '').trim()
  })
  const { totalItems } = useCart()
  const { settings } = useStoreSettings()

  const seo = useMemo(() => {
    const currentPath = stripQuery(router.asPath || '/')
    return getSeoContent(currentPath)
  }, [router.asPath])

  const pageUrl = useMemo(
    () => `${SITE_URL}${router.asPath || '/'}`,
    [router.asPath],
  )

  const handleHeaderSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const term = quickSearch.trim()
    setIsMenuOpen(false)
    void router.push({
      pathname: '/boutique',
      query: term ? { q: term } : {},
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

        <div className="header">
          <div className="container header__content">
            <div className="header__left">
              <button
                type="button"
                className="menu-toggle"
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-label="Ouvrir le menu"
              >
                Menu
              </button>

              <nav className={`nav ${isMenuOpen ? 'is-open' : ''}`}>
                <form className="nav-search" onSubmit={handleHeaderSearch}>
                  <input
                    type="search"
                    placeholder="Rechercher un produit..."
                    value={quickSearch}
                    onChange={(event) => setQuickSearch(event.target.value)}
                  />
                  <button type="submit">OK</button>
                </form>
                {storefrontLinks.map((link) => (
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
              <form className="header-search" onSubmit={handleHeaderSearch}>
                <input
                  type="search"
                  placeholder="Rechercher..."
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  aria-label="Rechercher un produit"
                />
                <button type="submit">Chercher</button>
              </form>

              <Link
                href="/contact"
                className={isPathActive('/contact', router.asPath || '/') ? 'nav-link is-active' : 'nav-link'}
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>

              <Link
                href="/panier"
                className={isPathActive('/panier', router.asPath || '/') ? 'nav-link is-active' : 'nav-link'}
                onClick={() => setIsMenuOpen(false)}
              >
                Panier
                {totalItems > 0 ? <span className="cart-count">{totalItems}</span> : null}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        <Link
          href="/"
          className={isPathActive('/', router.asPath || '/') ? 'mobile-nav-link is-active' : 'mobile-nav-link'}
        >
          <span>Accueil</span>
        </Link>
        <Link
          href="/boutique"
          className={isPathActive('/boutique', router.asPath || '/') ? 'mobile-nav-link is-active' : 'mobile-nav-link'}
        >
          <span>Boutique</span>
        </Link>
        <Link
          href="/panier"
          className={isPathActive('/panier', router.asPath || '/') ? 'mobile-nav-link is-active' : 'mobile-nav-link'}
        >
          <span>Panier</span>
          {totalItems > 0 ? <strong className="mobile-nav-count">{totalItems}</strong> : null}
        </Link>
        <Link
          href="/contact"
          className={isPathActive('/contact', router.asPath || '/') ? 'mobile-nav-link is-active' : 'mobile-nav-link'}
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
                <Link href="/boutique">Boutique</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/faq">FAQ</Link>
                <Link href="/cgv-retours">Conditions</Link>
                <Link href="/confidentialite">Confidentialite</Link>
              </nav>
            </div>

            <div className="footer-column">
              <p className="footer-title">Import Export</p>
              <p className="footer-note">Approvisionnement principal en Chine</p>
              <p className="footer-note">Distribution locale au Senegal</p>
              <p className="footer-note">Prix affiches en XOF</p>
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
