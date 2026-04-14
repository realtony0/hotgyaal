import Head from 'next/head'
import type { GetServerSideProps } from 'next'

const CONTACT_WHATSAPP =
  process.env.NEXT_PUBLIC_ORDER_CHAT_NUMBER ?? '221774931474'

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  // Statut 503 pour indiquer clairement aux moteurs de recherche
  // qu'il s'agit d'une indisponibilite temporaire.
  res.statusCode = 503
  res.setHeader('Retry-After', '3600')
  return { props: {} }
}

export default function MaintenancePage() {
  return (
    <>
      <Head>
        <title>HOTGYAAL — Site en maintenance</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta
          name="description"
          content="HOTGYAAL est momentanement en maintenance. Nous revenons tres vite."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>

      <main className="maintenance">
        <div className="maintenance__card">
          <span className="maintenance__badge">Maintenance en cours</span>
          <h1 className="maintenance__title">
            Nous revenons <em>tres bientot</em>
          </h1>
          <p className="maintenance__lead">
            HOTGYAAL est momentanement indisponible pendant que nous ameliorons
            votre experience. Merci de votre patience.
          </p>

          <div className="maintenance__actions">
            <a
              className="maintenance__button"
              href={`https://wa.me/${CONTACT_WHATSAPP}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Nous contacter sur WhatsApp
            </a>
            <a className="maintenance__link" href="mailto:contact@hotgyaal.com">
              contact@hotgyaal.com
            </a>
          </div>

          <p className="maintenance__signature">
            Merci de votre confiance.
            <br />
            L&apos;equipe HOTGYAAL
          </p>
        </div>
      </main>

      <style jsx>{`
        .maintenance {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.2rem;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(198, 150, 167, 0.28),
              transparent 28%
            ),
            radial-gradient(
              circle at 100% 100%,
              rgba(166, 123, 141, 0.2),
              transparent 30%
            ),
            linear-gradient(180deg, #fbfafb 0%, #f3edf0 100%);
          color: #1f171c;
        }

        .maintenance__card {
          max-width: 560px;
          width: 100%;
          background: #ffffff;
          border: 1px solid #e7dde3;
          border-radius: 1.8rem;
          padding: 3rem 2.2rem;
          text-align: center;
          box-shadow: 0 24px 60px -34px rgba(37, 18, 29, 0.35);
        }

        .maintenance__badge {
          display: inline-block;
          font-size: 0.72rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #9d6478;
          background: #f5f1f4;
          border: 1px solid #efe6eb;
          border-radius: 999px;
          padding: 0.45rem 0.95rem;
          font-weight: 600;
          margin-bottom: 1.6rem;
        }

        .maintenance__title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(1.9rem, 5vw, 2.6rem);
          font-weight: 600;
          line-height: 1.15;
          margin: 0 0 1rem;
          color: #2a1a22;
        }

        .maintenance__title em {
          font-style: italic;
          color: #9d6478;
        }

        .maintenance__lead {
          color: #6f5c67;
          font-size: 1rem;
          line-height: 1.55;
          margin: 0 0 2rem;
        }

        .maintenance__actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.9rem;
          margin-bottom: 2rem;
        }

        .maintenance__button {
          display: inline-block;
          background: #2a1a22;
          color: #ffffff;
          padding: 0.85rem 1.8rem;
          border-radius: 999px;
          font-weight: 600;
          letter-spacing: 0.02em;
          transition: transform 0.15s ease, background 0.15s ease;
          text-decoration: none;
        }

        .maintenance__button:hover {
          background: #9d6478;
          transform: translateY(-1px);
        }

        .maintenance__link {
          color: #6f5c67;
          font-size: 0.92rem;
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        .maintenance__signature {
          margin: 0;
          font-size: 0.85rem;
          color: #9d6478;
          letter-spacing: 0.04em;
          line-height: 1.6;
        }
      `}</style>
    </>
  )
}
