/*
 * Nom et teinte d'un coloris, attaches a l'adresse de sa photo.
 *
 * La base n'a pas de colonne pour les coloris, et la modifier demande un acces
 * au tableau de bord Supabase. On range donc ces informations dans le
 * fragment de l'URL de la photo :
 *
 *   https://…/products/abc.webp#coloris=Rouge%20bordeaux&teinte=6d1f3a
 *
 * Le fragment n'est jamais envoye au serveur : le navigateur et R2 servent la
 * meme image avec ou sans lui. Une photo sans fragment reste valable, sa
 * teinte est alors mesuree automatiquement.
 */

export type ColorDisplay = 'pastilles' | 'photos'

export type ColorTag = {
  /** Nom saisi dans l'administration */
  name?: string
  /** Teinte retenue, au format #rrggbb */
  hex?: string
  /** Choix d'affichage de la palette, porte par la premiere photo */
  display?: ColorDisplay
}

const HEX_PATTERN = /^[0-9a-f]{6}$/i

/** Adresse de l'image, sans les informations de coloris. */
export const stripColorTag = (url: string) => url.split('#')[0]

export const readColorTag = (url: string): ColorTag => {
  const hashIndex = url.indexOf('#')
  if (hashIndex < 0) {
    return {}
  }

  const params = new URLSearchParams(url.slice(hashIndex + 1))
  const name = params.get('coloris')?.trim()
  const hex = params.get('teinte')?.trim().replace('#', '')
  const display = params.get('affichage')

  return {
    name: name || undefined,
    hex: hex && HEX_PATTERN.test(hex) ? `#${hex.toLowerCase()}` : undefined,
    display: display === 'pastilles' || display === 'photos' ? display : undefined,
  }
}

export const writeColorTag = (url: string, tag: ColorTag) => {
  const base = stripColorTag(url)
  const params = new URLSearchParams()

  if (tag.name?.trim()) params.set('coloris', tag.name.trim())
  if (tag.hex && HEX_PATTERN.test(tag.hex.replace('#', ''))) {
    params.set('teinte', tag.hex.replace('#', '').toLowerCase())
  }
  if (tag.display) params.set('affichage', tag.display)

  const fragment = params.toString()
  return fragment ? `${base}#${fragment}` : base
}
