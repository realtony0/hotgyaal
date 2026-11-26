import type { Product } from '../types'

/*
 * Recherche du catalogue, partagee par la barre de recherche et la boutique.
 *
 * - Sans accents ni majuscules : "ete" trouve "Été", "VESTE" trouve "veste".
 * - Par debut de mot : "leg" trouve "Legging Yoga", "yog" aussi.
 * - Plusieurs mots : chacun doit se retrouver ("legging noir").
 * - Fautes de frappe : une lettre de travers est toleree sur les mots de
 *   4 lettres et plus ("leging", "sandal", "robbe").
 * - Le nom compte plus que la categorie, qui compte plus que la description.
 */

export const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const toWords = (value: string) => normalizeSearchText(value).split(' ').filter(Boolean)

/* Distance d'edition bornee : s'arrete des que la borne est depassee. */
const editDistanceWithin = (a: string, b: string, max: number) => {
  if (Math.abs(a.length - b.length) > max) return false
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      rowMin = Math.min(rowMin, current[j])
    }
    if (rowMin > max) return false
    previous = current
  }

  return previous[b.length] <= max
}

const typoBudget = (token: string) => (token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0)

/*
 * Note d'un mot tape face aux mots d'un champ. Une faute de frappe se compare
 * au mot entier, ou a son debut de meme longueur (on tape encore).
 */
const scoreToken = (token: string, words: string[], weight: number) => {
  let best = 0
  const budget = typoBudget(token)

  for (const word of words) {
    if (word === token) {
      best = Math.max(best, weight * 1.25)
    } else if (word.startsWith(token)) {
      best = Math.max(best, weight)
    } else if (token.length >= 3 && word.includes(token)) {
      best = Math.max(best, weight * 0.45)
    } else if (
      budget &&
      (editDistanceWithin(token, word, budget) ||
        editDistanceWithin(token, word.slice(0, token.length), budget))
    ) {
      best = Math.max(best, weight * 0.6)
    }
  }

  return best
}

export type SearchEntry = {
  product: Product
  name: string
  nameWords: string[]
  categoryWords: string[]
  descriptionWords: string[]
}

export const buildSearchEntries = (products: Product[]): SearchEntry[] =>
  products.map((product) => ({
    product,
    name: normalizeSearchText(product.name),
    nameWords: toWords(product.name),
    categoryWords: toWords(`${product.main_category} ${product.sub_category}`),
    descriptionWords: toWords(product.description ?? ''),
  }))

/** Note d'un produit pour une recherche, 0 si un mot tape n'est retrouve nulle part. */
export const scoreSearchEntry = (entry: SearchEntry, query: string) => {
  const tokens = toWords(query)
  if (!tokens.length) return 0

  let total = 0
  for (const token of tokens) {
    const score = Math.max(
      scoreToken(token, entry.nameWords, 100),
      scoreToken(token, entry.categoryWords, 45),
      scoreToken(token, entry.descriptionWords, 15),
    )
    if (!score) return 0
    total += score
  }

  const normalizedQuery = tokens.join(' ')
  if (entry.name.startsWith(normalizedQuery)) total += 60
  if (entry.product.is_best_seller) total += 5
  if (entry.product.is_out_of_stock) total -= 20

  return Math.max(total, 1)
}

export const searchCatalogue = (entries: SearchEntry[], query: string, limit?: number) => {
  const results = entries
    .map((entry) => ({ product: entry.product, score: scoreSearchEntry(entry, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.product)

  return typeof limit === 'number' ? results.slice(0, limit) : results
}

/*
 * Quand aucun article ne contient tous les mots ("sac rose"), on retire les
 * derniers mots un a un pour proposer quand meme quelque chose ("sac").
 */
export const searchCatalogueWithFallback = (entries: SearchEntry[], query: string) => {
  const words = query.trim().split(/\s+/).filter(Boolean)

  for (let count = words.length; count >= 1; count -= 1) {
    const usedQuery = words.slice(0, count).join(' ')
    const results = searchCatalogue(entries, usedQuery)
    if (results.length) {
      return { results, usedQuery, exact: count === words.length }
    }
  }

  return { results: [] as Product[], usedQuery: query.trim(), exact: true }
}

/** Vrai si un libelle (categorie, sous-categorie) correspond a la recherche. */
export const labelMatches = (label: string, query: string) => {
  const tokens = toWords(query)
  if (!tokens.length) return false
  const words = toWords(label)
  return tokens.every((token) => scoreToken(token, words, 1) >= 0.6)
}

export type HighlightPart = { text: string; match: boolean }

/*
 * Decoupe un libelle pour mettre en gras le debut des mots qui correspondent
 * a la recherche ("Leg" de "Legging").
 */
export const highlightMatches = (label: string, query: string): HighlightPart[] => {
  const tokens = toWords(query)
  if (!tokens.length) return [{ text: label, match: false }]

  const parts: HighlightPart[] = []
  let cursor = 0
  const wordPattern = /[\p{L}\p{N}]+/gu
  let found: RegExpExecArray | null

  while ((found = wordPattern.exec(label))) {
    const word = found[0]
    const normalized = normalizeSearchText(word)
    const token = tokens
      .filter((candidate) => normalized.startsWith(candidate))
      .sort((a, b) => b.length - a.length)[0]

    if (!token) continue

    // Un caractere accentue reste un seul caractere une fois normalise.
    const length = Math.min(token.length, word.length)
    if (found.index > cursor) parts.push({ text: label.slice(cursor, found.index), match: false })
    parts.push({ text: word.slice(0, length), match: true })
    cursor = found.index + length
  }

  if (cursor < label.length) parts.push({ text: label.slice(cursor), match: false })
  return parts
}

/*
 * La boutique ne garde plus d'historique de recherche. Les versions
 * precedentes en enregistraient un sur l'appareil : on l'efface.
 */
const RECENT_KEY = 'hotgyaal_recent_searches'

export const forgetRecentSearches = () => {
  try {
    window.localStorage.removeItem(RECENT_KEY)
  } catch {
    // stockage indisponible (navigation privee) : rien a effacer
  }
}
