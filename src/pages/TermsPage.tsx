export const TermsPage = () => {
  return (
    <section className="section static-page">
      <div className="container">
        <h1>Conditions de vente</h1>
        <p>
          Ces conditions encadrent les commandes HOTGYAAL pour la vente au
          Senegal.
        </p>

        <div className="faq-list">
          <article className="static-page__card">
            <h2>Validation de commande</h2>
            <p>
              Toute commande transmise implique l'acceptation des prix produits,
              des informations client saisies et des conditions commerciales
              affichees au panier.
            </p>
          </article>

          <article className="static-page__card">
            <h2>Transport et delais</h2>
            <p>
              Trois options transport sont proposees au panier. Le cout final du
              transport est confirme apres verification du poids ou du volume
              reel de la commande.
            </p>
          </article>

          <article className="static-page__card">
            <h2>Approvisionnement</h2>
            <p>
              HOTGYAAL opere en import-export: sourcing et achats en Chine,
              commercialisation au Senegal.
            </p>
          </article>

          <article className="static-page__card">
            <h2>Echanges et reclamations</h2>
            <p>
              Toute demande est etudiee par le service client selon l'etat du
              produit et la nature de la reclamation.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
