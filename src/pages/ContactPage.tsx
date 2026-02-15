import { useStoreSettings } from '../context/StoreSettingsContext'

export const ContactPage = () => {
  const { settings } = useStoreSettings()

  return (
    <section className="section contact-v2">
      <div className="container">
        <div className="contact-v2__hero">
          <p className="eyebrow">Contact HOTGYAAL</p>
          <h1>Parlons de votre commande</h1>
          <p>{settings.contact_intro}</p>
        </div>

        <div className="contact-v2__grid">
          <article className="contact-v2__card">
            <h2>Coordonnees</h2>
            <p>
              <strong>Telephone</strong>
              <span>{settings.contact_phone}</span>
            </p>
            <p>
              <strong>Email</strong>
              <span>{settings.contact_email}</span>
            </p>
            <p>
              <strong>Disponibilite</strong>
              <span>{settings.contact_hours}</span>
            </p>
          </article>

          <article className="contact-v2__card">
            <h2>Zone commerciale</h2>
            <p>
              Collections proposees avec un sourcing import-export depuis la Chine.
            </p>
            <p>
              Le catalogue est mis a jour regulierement selon les arrivages et les
              tendances.
            </p>
          </article>

          <article className="contact-v2__card">
            <h2>Service client</h2>
            <p>
              Pour une commande en cours, indiquez votre nom et votre numero lors de
              votre prise de contact pour un traitement plus rapide.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
