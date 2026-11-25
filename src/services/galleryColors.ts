import { useEffect, useState } from 'react'

/*
 * Coloris tires de la galerie photo d'un produit.
 *
 * Beaucoup de fiches n'ont qu'un nom, mais une galerie de 10 a 25 photos :
 * une photo par coloris. La route /api/coloris mesure la couleur de l'article
 * sur chaque photo, et le resultat est garde en cache par le CDN. Ici, on
 * l'interroge depuis le navigateur.
 */

export type GalleryColor = {
  /** Photo du coloris */
  url: string
  /** Couleur mesuree, ou null si la photo ne permet pas de la lire */
  hex: string | null
  /** Nom approximatif de la teinte ("Rouge", "Bleu marine"...) */
  name: string | null
}

export type GalleryColorsResponse = {
  /**
   * "couleurs" : les teintes mesurees se distinguent bien, on affiche des
   * pastilles unies. "photos" : elles se ressemblent trop (baskets blanches a
   * details colores, par exemple), on affiche des vignettes.
   */
  mode: 'couleurs' | 'photos'
  colors: GalleryColor[]
}

export type GalleryColorIndex = Record<string, { count: number; version: string }>

const responseCache = new Map<string, Promise<GalleryColorsResponse | null>>()
let indexPromise: Promise<GalleryColorIndex> | null = null

const versionOf = (updatedAt: string | null | undefined) =>
  updatedAt ? String(new Date(updatedAt).getTime() || updatedAt) : '0'

export const fetchGalleryColors = (productId: string, updatedAt?: string | null) => {
  const key = `${productId}:${versionOf(updatedAt)}`
  const cached = responseCache.get(key)
  if (cached) {
    return cached
  }

  const request = fetch(
    `/api/coloris?id=${encodeURIComponent(productId)}&v=${encodeURIComponent(versionOf(updatedAt))}`,
  )
    .then((response) => (response.ok ? (response.json() as Promise<GalleryColorsResponse>) : null))
    .catch(() => null)

  responseCache.set(key, request)
  return request
}

/** Nombre de coloris par produit, pour les cartes du catalogue. */
export const fetchGalleryColorIndex = () => {
  if (!indexPromise) {
    indexPromise = fetch('/api/coloris')
      .then((response) =>
        response.ok ? (response.json() as Promise<{ index: GalleryColorIndex }>) : { index: {} },
      )
      .then((payload) => payload.index ?? {})
      .catch(() => {
        indexPromise = null
        return {}
      })
  }
  return indexPromise
}

export const useGalleryColorIndex = () => {
  const [index, setIndex] = useState<GalleryColorIndex>({})

  useEffect(() => {
    let ignore = false
    void fetchGalleryColorIndex().then((value) => {
      if (!ignore) setIndex(value)
    })
    return () => {
      ignore = true
    }
  }, [])

  return index
}

export const useGalleryColors = (
  productId: string | null,
  updatedAt: string | null | undefined,
  enabled: boolean,
) => {
  const [state, setState] = useState<{ key: string; data: GalleryColorsResponse | null } | null>(
    null,
  )
  const key = productId ? `${productId}:${versionOf(updatedAt)}` : ''

  useEffect(() => {
    if (!enabled || !productId) {
      return
    }

    let ignore = false
    void fetchGalleryColors(productId, updatedAt).then((data) => {
      if (!ignore) setState({ key, data })
    })

    return () => {
      ignore = true
    }
  }, [enabled, key, productId, updatedAt])

  const ready = state?.key === key
  return { loading: enabled && !ready, data: ready ? state.data : null }
}

/** Libelle du coloris tel qu'il part dans la commande. */
export const describeGalleryColor = (index: number, name: string | null | undefined) =>
  name ? `Coloris ${index + 1} (${name})` : `Coloris ${index + 1}`
