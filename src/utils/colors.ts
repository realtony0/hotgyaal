/*
 * Traduit un nom de coloris ("Rouge bordeaux", "Bleu ciel", "Vert forêt")
 * en couleur affichable pour les pastilles.
 *
 * Les noms viennent des fiches produit, saisis a la main : on cherche des
 * mots-cles plutot qu'une correspondance exacte. Les regles precises
 * (bordeaux, ciel, marine...) passent avant les regles generales (rouge,
 * bleu...). Un nom inconnu donne une pastille neutre avec le nom en
 * info-bulle : le client garde l'information, meme sans la couleur.
 */

export type SwatchColor = {
  /** Couleur CSS, ou "multi" pour un imprime / multicolore */
  value: string
  /** Vrai pour les teintes tres claires, qui ont besoin d'un contour marque */
  light: boolean
}

const RULES: [RegExp, string][] = [
  // Teintes precises d'abord
  [/bordeaux|burgundy|vin\b|wine|grenat|lie de vin/i, '#6d1f3a'],
  [/bleu\s*ciel|sky|bleu\s*clair|bleu\s*pastel|baby\s*blue/i, '#9cc7ea'],
  [/marine|navy|bleu\s*nuit|bleu\s*fonc/i, '#1f2f5c'],
  [/turquoise|cyan|bleu\s*canard|teal|pétrole|petrole/i, '#2a8f9c'],
  [/vert\s*for[eê]t|forest|vert\s*fonc|sapin|bouteille/i, '#1f4d35'],
  [/vert\s*neptune|émeraude|emeraude|emerald/i, '#1f8a62'],
  [/menthe|mint|vert\s*clair|vert\s*pastel|pistache|vert\s*d'eau/i, '#a9dcc3'],
  [/olive|kaki|khaki|militaire|army/i, '#6b7a3a'],
  [/sauge|sage|eucalyptus/i, '#9bb59a'],
  [/rose\s*pâle|rose\s*pale|rose\s*clair|rose\s*poudr|nude\s*rose|blush|baby\s*pink/i, '#f2c6d2'],
  [/fuchsia|magenta|rose\s*vif|rose\s*fluo|hot\s*pink/i, '#d6278a'],
  [/corail|coral|saumon|salmon|pêche|peche|peach/i, '#f08a6b'],
  [/abricot|mandarine|tangerine/i, '#f1963c'],
  [/moutarde|mustard|ocre|ochre|curry/i, '#c9962b'],
  [/dor[ée]|gold|or\b/i, '#c9a44c'],
  [/argent|silver|chrome|métal|metal/i, '#b8b8c0'],
  [/lilas|lavande|lavender|parme|mauve/i, '#b48ed6'],
  [/prune|aubergine|plum|violet\s*fonc/i, '#4e2a5a'],
  [/café|cafe|coffee|moka|mocha|chocolat|chocolate|cacao|marron\s*fonc/i, '#5a3b2a'],
  [/camel|caramel|cognac|tabac|tan\b|fauve/i, '#b57c48'],
  [/taupe|greige|mastic/i, '#a39383'],
  [/beige|sable|sand|nude|écru|ecru|crème|creme|cream|ivoire|ivory|champagne/i, '#e6d6bf'],
  [/anthracite|charbon|charcoal|gris\s*fonc/i, '#3f3f45'],
  [/gris\s*brun|gris\s*clair|gris\s*perle|argile/i, '#b9b3ad'],
  // Familles
  [/noir|black|ébène|ebene/i, '#1a1a1a'],
  [/blanc|white|neige/i, '#f7f5f2'],
  [/gris|grey|gray|souris/i, '#8f8f95'],
  [/rouge|red|cerise|cherry|carmin|écarlate|ecarlate/i, '#c62828'],
  [/rose|pink/i, '#ea8fb4'],
  [/orange|brique|brick|rouille|rust|terracotta/i, '#e4702f'],
  [/jaune|yellow|citron|lemon|banane/i, '#f0d23c'],
  [/vert|green/i, '#2f8a4f'],
  [/bleu|blue|denim|jean|indigo|bic/i, '#2d5ba9'],
  [/violet|purple|pourpre/i, '#6f3fa0'],
  [/marron|brun|brown|chocolat/i, '#7a5236'],
  // Imprimes
  [/léopard|leopard|zèbre|zebre|imprim|motif|fleur|floral|rayé|raye|ray[ée]s|carreaux|multicolore|multi\b|arc-en-ciel|tie\s*dye|camouflage|camo\b/i, 'multi'],
]

const LIGHT_COLORS = new Set(['#f7f5f2', '#e6d6bf', '#f2c6d2', '#a9dcc3', '#9cc7ea', '#f0d23c', '#b9b3ad'])

export const resolveSwatchColor = (name: string | null | undefined): SwatchColor | null => {
  if (!name) {
    return null
  }

  const match = RULES.find(([pattern]) => pattern.test(name))
  if (!match) {
    return null
  }

  return { value: match[1], light: LIGHT_COLORS.has(match[1]) }
}
