import type { Product } from '../types'

/*
 * Tenues de sport.
 *
 * En base, c'est une sous-categorie de "Vetements Femmes". Avec 40 % du
 * catalogue, elle a sa propre page (/sport), son entree dans le menu et sa
 * section sur l'accueil. Rien ne change dans le schema : on reconnait ces
 * produits a partir de la colonne existante.
 */

export const SPORT_SUB_CATEGORY = 'Tenues de sport'

const normalize = (value: string) => value.trim().toLowerCase()

export const isSportProduct = (product: Pick<Product, 'sub_category'>) =>
  normalize(product.sub_category) === normalize(SPORT_SUB_CATEGORY)

/*
 * Familles de pieces sport, deduites du nom des articles.
 *
 * La base ne distingue pas un legging d'une brassiere : tout est
 * "Tenues de sport". Les noms, eux, sont parlants. L'ordre des regles compte :
 * un "ensemble" l'emporte sur le "short" qu'il contient.
 */
export type SportFamily = {
  id: string
  name: string
  pattern: RegExp
}

export const SPORT_FAMILIES: SportFamily[] = [
  { id: 'ensembles', name: 'Ensembles', pattern: /ensemble|\bset\b|combi|jumpsuit/i },
  { id: 'vestes', name: 'Vestes & sweats', pattern: /veste|sweat|hoodie|jacket|zip/i },
  {
    id: 'tops',
    name: 'Tops & brassières',
    pattern: /\bbra\b|brassi|\btop|d[ée]bardeur|t-shirt|\btee\b|manches/i,
  },
  { id: 'shorts', name: 'Shorts', pattern: /short/i },
  {
    id: 'leggings',
    name: 'Leggings & pantalons',
    pattern: /legging|\bpant|pantalon|jogg|wide-leg/i,
  },
]

export const getSportFamily = (product: Pick<Product, 'name'>) =>
  SPORT_FAMILIES.find((family) => family.pattern.test(product.name)) ?? null
