import type { NextApiRequest, NextApiResponse } from 'next'
import { extractGarmentColor } from '../../src/lib/garmentColor'
import { getSupabase, isSupabaseConfigured } from '../../src/lib/supabase'
import type { GalleryColor, GalleryColorIndex } from '../../src/services/galleryColors'
import { deltaE, hexToRgb, nameForHex, rgbToLab } from '../../src/utils/colors'

/*
 * Coloris d'un produit, lus sur ses photos.
 *
 *   GET /api/coloris            index { id: { count, version } } des fiches
 *                               qui ont au moins deux photos
 *   GET /api/coloris?id=…&v=…   couleur mesuree sur chaque photo de la fiche
 *
 * Le calcul telecharge chaque photo : il n'a lieu qu'une fois par version de
 * fiche, ensuite le CDN de Vercel sert la reponse en cache. Le parametre v
 * (date de mise a jour) change quand la galerie change, ce qui invalide le
 * cache au bon moment.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IMAGES = 60
const CONCURRENCY = 6
const FETCH_TIMEOUT_MS = 8000
const MAX_IMAGE_BYTES = 15 * 1024 * 1024

/*
 * Deux teintes a moins de cet ecart se confondent sur une pastille de 30 px.
 * Mesure sur le catalogue : les galeries de coloris unis (leggings, sacs,
 * t-shirts, jupes) gardent 48 a 53 % de teintes distinctes a cet ecart, les
 * baskets blanches a details colores 19 a 22 %.
 */
const SAME_COLOR_DELTA = 20
/** Part minimale de teintes distinctes pour afficher des pastilles unies. */
const DISTINCT_RATIO_FOR_SWATCHES = 0.4

/*
 * Petites galeries (2 a 4 photos) : ce sont souvent des angles du meme article
 * (face, dos, detail). On n'y affiche des pastilles que si toutes les teintes
 * s'ecartent nettement. Mesure : coloris reels a 18 minimum, vues d'un meme
 * jean ou pantalon a 3 maximum.
 */
const SMALL_GALLERY_SIZE = 4
const SMALL_GALLERY_MIN_DELTA = 12

/*
 * On ne telecharge que depuis le stockage de la boutique : la route ne doit pas
 * pouvoir servir de relais vers n'importe quelle adresse.
 */
const isAllowedImageUrl = (value: string) => {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') {
      return url.hostname.endsWith('.r2.dev') || url.hostname.endsWith('.supabase.co')
    }
    return process.env.NODE_ENV !== 'production' && url.hostname === 'localhost'
  } catch {
    return false
  }
}

const imagesOf = (product: { image_url: string | null; gallery_urls: string[] | null }) =>
  Array.from(
    new Set([product.image_url, ...(product.gallery_urls ?? [])].filter(Boolean) as string[]),
  )

const versionOf = (updatedAt: string | null) =>
  updatedAt ? String(new Date(updatedAt).getTime() || updatedAt) : '0'

const measure = async (url: string): Promise<string | null> => {
  if (!isAllowedImageUrl(url)) {
    return null
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) {
      return null
    }

    const length = Number(response.headers.get('content-length') || 0)
    if (length > MAX_IMAGE_BYTES) {
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return await extractGarmentColor(buffer)
  } catch {
    return null
  }
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let cursor = 0

  const run = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

/*
 * Des pastilles unies n'ont de sens que si les teintes se distinguent. Sur des
 * baskets blanches a details colores, toutes les mesures tombent dans les
 * gris : on affiche alors les photos.
 */
const chooseMode = (colors: GalleryColor[]): 'couleurs' | 'photos' => {
  const measured = colors.filter((color) => color.hex)
  if (measured.length < 2 || measured.length < colors.length * 0.8) {
    return 'photos'
  }

  const labs = measured.map((color) => rgbToLab(...hexToRgb(color.hex as string)))

  if (labs.length <= SMALL_GALLERY_SIZE) {
    const allApart = labs.every((lab, index) =>
      labs.slice(index + 1).every((other) => deltaE(lab, other) >= SMALL_GALLERY_MIN_DELTA),
    )
    return allApart ? 'couleurs' : 'photos'
  }

  const distinct: typeof labs = []
  labs.forEach((lab) => {
    if (!distinct.some((existing) => deltaE(existing, lab) < SAME_COLOR_DELTA)) {
      distinct.push(lab)
    }
  })

  return distinct.length / labs.length >= DISTINCT_RATIO_FOR_SWATCHES ? 'couleurs' : 'photos'
}

const handleIndex = async (res: NextApiResponse) => {
  const { data, error } = await getSupabase()
    .from('products')
    .select('id,image_url,gallery_urls,updated_at')

  if (error) {
    return res.status(502).json({ error: 'Catalogue indisponible.' })
  }

  const index: GalleryColorIndex = {}
  ;(data ?? []).forEach((product) => {
    const count = imagesOf(product).length
    if (count >= 2) {
      index[product.id] = { count, version: versionOf(product.updated_at) }
    }
  })

  // Liste legere, rafraichie toutes les quelques minutes.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
  return res.status(200).json({ index })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Méthode non autorisée.' })
  }

  if (!isSupabaseConfigured) {
    return res.status(501).json({ error: 'Catalogue non configuré.' })
  }

  const id = typeof req.query.id === 'string' ? req.query.id.trim() : ''
  if (!id) {
    return handleIndex(res)
  }

  if (!UUID_PATTERN.test(id)) {
    return res.status(400).json({ error: 'Identifiant invalide.' })
  }

  const { data: product, error } = await getSupabase()
    .from('products')
    .select('id,image_url,gallery_urls,updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return res.status(502).json({ error: 'Catalogue indisponible.' })
  }

  if (!product) {
    return res.status(404).json({ error: 'Produit introuvable.' })
  }

  const images = imagesOf(product).slice(0, MAX_IMAGES)
  const hexes = await mapWithConcurrency(images, CONCURRENCY, measure)
  const colors: GalleryColor[] = images.map((url, index) => ({
    url,
    hex: hexes[index],
    name: hexes[index] ? nameForHex(hexes[index] as string) : null,
  }))

  const requestedVersion = typeof req.query.v === 'string' ? req.query.v : ''
  const isCurrentVersion = requestedVersion === versionOf(product.updated_at)

  // Une version precise ne change plus : cache long. Sinon, cache court.
  res.setHeader(
    'Cache-Control',
    isCurrentVersion
      ? 'public, s-maxage=2592000, stale-while-revalidate=86400'
      : 'public, s-maxage=600, stale-while-revalidate=3600',
  )

  return res.status(200).json({ mode: chooseMode(colors), colors })
}
