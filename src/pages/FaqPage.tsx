const FAQ_ITEMS = [
  {
    question: 'Comment passer commande ?',
    answer:
      "Ajoutez vos articles au panier, choisissez votre option transport puis finalisez votre demande.",
  },
  {
    question: 'Comment sont calcules les frais de transport ?',
    answer:
      "Le choix du mode transport est fait au panier. Le montant final est confirme ensuite selon le poids ou le volume reel de la commande.",
  },
  {
    question: 'Les produits sont-ils disponibles en plusieurs couleurs ?',
    answer:
      'Oui. Plusieurs articles existent en differentes couleurs avec des photos dediees.',
  },
  {
    question: 'Ou est basee HOTGYAAL ?',
    answer:
      "La vente est au Senegal. Le sourcing et les achats fournisseurs sont geres en Chine dans une logique d'import-export.",
  },
  {
    question: 'Comment contacter le service client ?',
    answer:
      'Via la page Contact au +221 77 493 14 74 ou par email: sophieniang344@gmail.com.',
  },
]

export const FaqPage = () => {
  return (
    <section className="section static-page">
      <div className="container">
        <h1>FAQ</h1>
        <p>Reponses rapides aux questions les plus frequentes.</p>

        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <article key={item.question} className="static-page__card">
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
