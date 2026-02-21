import Link from 'next/link'
import { useStoreSettings } from '../context/StoreSettingsContext'

export const AccountPage = () => {
  const { settings } = useStoreSettings()

  return (
    <section className="section account-page">
      <div className="container">
        <div className="account-card">
          <p className="eyebrow">Espace compte</p>
          <h1>Suivre votre commande</h1>
          <p>
            Pour le suivi, contactez notre equipe avec votre numero de telephone et votre nom.
          </p>

          <div className="account-card__actions">
            <a
              className="button"
              href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
            >
              Appeler le service client
            </a>
            <Link href="/contact" className="button button--ghost">
              Aller a la page contact
            </Link>
          </div>

          <div className="account-card__meta">
            <span>{settings.contact_phone}</span>
            <span>{settings.contact_email}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
