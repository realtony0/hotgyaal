export const PrivacyPage = () => {
  return (
    <section className="section static-page">
      <div className="container">
        <h1>Politique de confidentialité</h1>
        <p>
          HOTGYAAL protège les données personnelles de ses clientes et visiteurs.
        </p>

        <div className="faq-list">
          <article className="static-page__card">
            <h2>Données collectées</h2>
            <p>
              Nous collectons uniquement les informations nécessaires pour traiter
              les commandes et assurer le service client.
            </p>
          </article>

          <article className="static-page__card">
            <h2>Utilisation</h2>
            <p>
              Les données sont utilisées pour le suivi de commande, la relation
              client et l'amélioration de la boutique.
            </p>
          </article>

          <article className="static-page__card">
            <h2>Conservation</h2>
            <p>
              Les données sont stockées de façon sécurisée et ne sont pas vendues
              à des tiers.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
