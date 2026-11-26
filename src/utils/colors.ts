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

/*
 * Nommage approximatif d'une teinte mesuree sur une photo.
 *
 * On compare la couleur a une liste de teintes nommees dans l'espace Lab,
 * ou la distance suit mieux la perception que le RGB. Le nom reste indicatif :
 * c'est la photo du coloris qui fait foi, et elle accompagne la commande.
 */

const NAMED_COLORS: [string, string][] = [
  ['Noir', '#1a1a1c'],
  ['Anthracite', '#3f3f45'],
  ['Gris', '#8f8f95'],
  ['Gris clair', '#c4c4c6'],
  ['Blanc', '#f5f5f2'],
  ['Crème', '#ece3d0'],
  ['Beige', '#d6c3a5'],
  ['Sable', '#c8b08a'],
  ['Taupe', '#8b7d70'],
  ['Camel', '#b07c48'],
  ['Marron', '#6b4430'],
  ['Chocolat', '#3d2b1e'],
  ['Bordeaux', '#6d1f3a'],
  ['Rouge', '#c0282d'],
  ['Framboise', '#a81e47'],
  ['Fuchsia', '#d6278a'],
  ['Rose', '#e889ac'],
  ['Rose pâle', '#f2c6d2'],
  ['Vieux rose', '#c98a96'],
  ['Corail', '#f08a6b'],
  ['Orange', '#e4702f'],
  ['Moutarde', '#c9962b'],
  ['Jaune', '#f0d23c'],
  ['Jaune pâle', '#f5e48f'],
  ['Kaki', '#6b7a3a'],
  ['Vert sauge', '#a2ab92'],
  ['Menthe', '#a9dcc3'],
  ['Vert', '#2f8a4f'],
  ['Vert foncé', '#1f4d35'],
  ['Émeraude', '#0e8a5c'],
  ['Turquoise', '#2a9c9c'],
  ['Bleu canard', '#2f5c6a'],
  ['Bleu ciel', '#a8cbe8'],
  ['Bleu', '#2f5fb0'],
  ['Bleu roi', '#1e4dd6'],
  ['Bleu marine', '#1c2547'],
  ['Lavande', '#b7a8d8'],
  ['Violet', '#6f3fa0'],
  ['Prune', '#4e2a5a'],
  ['Mauve', '#8e5a7a'],
]

export type Lab = [number, number, number]

export const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

export const rgbToLab = (r: number, g: number, b: number): Lab => {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047)
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722)
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

export const deltaE = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

const NAMED_LABS = NAMED_COLORS.map(([name, hex]) => ({
  name,
  lab: rgbToLab(...hexToRgb(hex)),
}))

/** Saturation percue : sous ce seuil, une teinte se lit comme un gris. */
export const NEUTRAL_CHROMA = 7

export const chromaOf = (lab: Lab) => Math.hypot(lab[1], lab[2])

export const nameForHex = (hex: string) => {
  const lab = rgbToLab(...hexToRgb(hex))

  // Les gris se nomment a la clarte : la teinte voisine la plus proche
  // ("Vert sauge" pour un gris chaud) serait trompeuse.
  if (chromaOf(lab) < NEUTRAL_CHROMA) {
    if (lab[0] < 22) return 'Noir'
    if (lab[0] < 38) return 'Anthracite'
    if (lab[0] < 62) return 'Gris'
    if (lab[0] < 82) return 'Gris clair'
    return 'Blanc'
  }

  let best = NAMED_LABS[0]
  let bestDistance = Infinity

  for (const entry of NAMED_LABS) {
    const distance = deltaE(lab, entry.lab)
    if (distance < bestDistance) {
      bestDistance = distance
      best = entry
    }
  }

  return best.name
}

/** Vrai pour les teintes tres claires, qui ont besoin d'un contour marque. */
export const isLightHex = (hex: string) => rgbToLab(...hexToRgb(hex))[0] > 82
