import { useStoreSettings } from '../context/StoreSettingsContext'

export const ContactPage = () => {
  const { settings } = useStoreSettings()

  return (
    <section className="section static-page">
      <div className="container">
        <h1>Contact</h1>
        <p>{settings.contact_intro}</p>

        <div className="static-page__grid">
          <article className="static-page__card">
            <h2>Service client</h2>
            <p>Contact direct: {settings.contact_phone}</p>
            <p>Email: {settings.contact_email}</p>
            <p>Disponibilite: {settings.contact_hours}</p>
          </article>

          <article className="static-page__card">
            <h2>Zone de vente</h2>
            <p>Dakar et Senegal</p>
            <p>
              Selection produits et achats en Chine, distribution locale au
              Senegal.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
