import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'

const storefrontLinks = [
  { to: '/', label: 'Accueil' },
  { to: '/boutique', label: 'Boutique' },
  { to: '/boutique?categorie=V%C3%AAtements%20Femmes&sous_categorie=Robes', label: 'Robes' },
  { to: '/boutique?categorie=Bijoux%20%26%20Accessoires', label: 'Accessoires' },
  { to: '/boutique?categorie=Chaussures', label: 'Chaussures' },
]

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://hotgyaal.com'

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

  if (pathname.startsWith('/admin')) {
    return {
      title: 'Admin HOTGYAAL',
      description: 'Back-office HOTGYAAL pour la gestion produits et commandes.',
    }
  }

  return {
    title: 'HOTGYAAL - Boutique Multi-Categories',
    description:
      'HOTGYAAL: boutique multi-categories au Senegal avec importation depuis la Chine et panier complet en XOF.',
  }
}

const setMeta = (
  selector: string,
  content: string,
  attr: 'name' | 'property' = 'name',
) => {
  const element = document.head.querySelector(
    `meta[${attr}="${selector}"]`,
  ) as HTMLMetaElement | null

  if (element) {
    element.setAttribute('content', content)
    return
  }

  const meta = document.createElement('meta')
  meta.setAttribute(attr, selector)
  meta.setAttribute('content', content)
  document.head.append(meta)
}

export const Layout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { totalItems } = useCart()
  const location = useLocation()

  useEffect(() => {
    const seo = getSeoContent(location.pathname)
    document.title = seo.title

    const pageUrl = `${SITE_URL}${location.pathname}${location.search}`

    setMeta('description', seo.description)
    setMeta('og:title', seo.title, 'property')
    setMeta('og:description', seo.description, 'property')
    setMeta('og:url', pageUrl, 'property')
    setMeta('twitter:title', seo.title)
    setMeta('twitter:description', seo.description)

    let canonical = document.head.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null

    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.append(canonical)
    }

    canonical.setAttribute('href', pageUrl)
  }, [location.pathname, location.search])

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="announcement-bar">
          <div className="container announcement-bar__content">
            Mode femme & accessoires · Vente au Senegal · Importation directe Chine
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
                {storefrontLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      isActive ? 'nav-link is-active' : 'nav-link'
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <Link to="/" className="brand brand--center">
              HOTGYAAL
            </Link>

            <div className="header__actions">
              <NavLink to="/contact" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                Contact
              </NavLink>

              <NavLink to="/panier" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                Panier
                {totalItems > 0 ? <span className="cart-count">{totalItems}</span> : null}
              </NavLink>
            </div>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'mobile-nav-link is-active' : 'mobile-nav-link')}>
          <span>Accueil</span>
        </NavLink>
        <NavLink
          to="/boutique"
          className={({ isActive }) => (isActive ? 'mobile-nav-link is-active' : 'mobile-nav-link')}
        >
          <span>Boutique</span>
        </NavLink>
        <NavLink to="/panier" className={({ isActive }) => (isActive ? 'mobile-nav-link is-active' : 'mobile-nav-link')}>
          <span>Panier</span>
          {totalItems > 0 ? <strong className="mobile-nav-count">{totalItems}</strong> : null}
        </NavLink>
        <NavLink
          to="/contact"
          className={({ isActive }) => (isActive ? 'mobile-nav-link is-active' : 'mobile-nav-link')}
        >
          <span>Contact</span>
        </NavLink>
      </nav>

      <footer className="footer">
        <div className="container footer__content footer__content--grid">
          <div className="footer-brand">
            <strong>HOTGYAAL</strong>
            <p>
              Specialiste mode femme, accessoires et chaussures. Vente au
              Senegal avec importation directe depuis la Chine.
            </p>
            <div className="footer-contact-inline">
              <span>+221 77 493 14 74</span>
              <span>sophieniang344@gmail.com</span>
            </div>
          </div>

          <div className="footer-columns">
            <div className="footer-column">
              <p className="footer-title">Navigation</p>
              <nav className="footer-links">
                <Link to="/boutique">Boutique</Link>
                <Link to="/contact">Contact</Link>
                <Link to="/faq">FAQ</Link>
                <Link to="/cgv-retours">Conditions</Link>
                <Link to="/confidentialite">Confidentialite</Link>
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
