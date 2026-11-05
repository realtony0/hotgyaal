import { getSupabase } from '../lib/supabase'
import { getProductVariantMeta } from '../utils/products'
import { compressImageFile } from '../utils/image'
import { StorageNotConfiguredError, uploadToR2 } from './storage'
import type { Product, ProductPayload } from '../types'

const PRODUCT_BUCKET = 'product-images'

/*
 * Colonnes chargees pour les grilles. La galerie n'y sert jamais - seule la
 * fiche produit l'affiche - et elle pese pres de 15 % de la reponse. La retirer
 * allege chaque chargement de page, ce qui compte sur une connexion mobile.
 */
/*
 * Un nom de produit peut contenir % ou _, qui sont les jokers de LIKE.
 * Sans echappement, "100% coton" ramenerait n'importe quoi.
 */
const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, '\\$&')

const LIST_COLUMNS =
  'id,name,slug,description,price,compare_price,stock,main_category,sub_category,image_url,sizes,is_out_of_stock,is_new,is_best_seller,created_at,updated_at'
const DEFAULT_SIZE = 'Taille unique'
const PRODUCT_CACHE_KEY = 'hotgyaal_products_cache_v1'
const PRODUCT_CACHE_TTL_MS = 1000 * 60 * 10
type ProductCacheEntry = {
  expiresAt: number
  data: Product[]
}

type ListProductsOptions = {
  forceFresh?: boolean
}

let memoryProductCache: ProductCacheEntry | null = null
let listProductsPromise: Promise<Product[]> | null = null

const createFileToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizeProduct = (raw: Product): Product => {
  const sizes = Array.from(
    new Set(
      (Array.isArray(raw.sizes) ? raw.sizes : [])
        .map((size) => size.trim())
        .filter(Boolean),
    ),
  )

  const normalizedSizes = sizes.length ? sizes : [DEFAULT_SIZE]
  const hasOutOfStockFlag = typeof raw.is_out_of_stock === 'boolean'
  const outOfStockFromStock = typeof raw.stock === 'number' ? raw.stock <= 0 : false

  return {
    ...raw,
    gallery_urls: Array.isArray(raw.gallery_urls) ? raw.gallery_urls : [],
    sizes: normalizedSizes,
    is_out_of_stock: hasOutOfStockFlag ? raw.is_out_of_stock : outOfStockFromStock,
    stock: typeof raw.stock === 'number' ? raw.stock : raw.is_out_of_stock ? 0 : 999,
  }
}

const isCacheEntryValid = (entry: ProductCacheEntry | null): entry is ProductCacheEntry => {
  if (!entry) {
    return false
  }

  if (!Array.isArray(entry.data) || typeof entry.expiresAt !== 'number') {
    return false
  }

  return entry.expiresAt > Date.now()
}

const readStoredProductsCache = (): ProductCacheEntry | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(PRODUCT_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as ProductCacheEntry
    if (!isCacheEntryValid(parsed)) {
      window.localStorage.removeItem(PRODUCT_CACHE_KEY)
      return null
    }

    return {
      expiresAt: parsed.expiresAt,
      data: parsed.data.map(normalizeProduct),
    }
  } catch {
    return null
  }
}

const readProductsCache = (): Product[] | null => {
  if (isCacheEntryValid(memoryProductCache)) {
    return memoryProductCache.data
  }

  const stored = readStoredProductsCache()
  if (!stored) {
    memoryProductCache = null
    return null
  }

  memoryProductCache = stored
  return stored.data
}

const writeProductsCache = (products: Product[]) => {
  const entry: ProductCacheEntry = {
    expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS,
    data: products,
  }

  memoryProductCache = entry

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(entry))
    } catch {
      // ignore storage write errors (quota/private mode)
    }
  }
}

export const clearProductsCache = () => {
  memoryProductCache = null
  listProductsPromise = null

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PRODUCT_CACHE_KEY)
    } catch {
      // ignore storage cleanup errors
    }
  }
}

export const listProducts = async (
  options: ListProductsOptions = {},
): Promise<Product[]> => {
  const { forceFresh = false } = options

  if (!forceFresh) {
    const cached = readProductsCache()
    if (cached) {
      return cached
    }
  }

  if (listProductsPromise) {
    return listProductsPromise
  }

  const request = (async () => {
  const client = getSupabase()
  const { data, error } = await client
    .from('products')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const normalized = ((data ?? []) as Product[]).map(normalizeProduct)
  writeProductsCache(normalized)
  return normalized
  })()

  listProductsPromise = request

  try {
    return await request
  } finally {
    if (listProductsPromise === request) {
      listProductsPromise = null
    }
  }
}

export const getProductBySlug = async (slug: string): Promise<Product | null> => {
  const normalizedSlug = slug.trim().toLowerCase()
  if (!normalizedSlug) {
    return null
  }

  const client = getSupabase()
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('slug', normalizedSlug)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? normalizeProduct(data as Product) : null
}

/**
 * Fiche produit et ses declinaisons de couleur, en deux requetes ciblees.
 *
 * Les variantes se reconnaissent au nom : "Top Azur - Noir" et
 * "Top Azur - Blanc" partagent la base "Top Azur". On interroge donc ce
 * prefixe plutot que de charger les 600 fiches du catalogue pour en retenir
 * deux ou trois.
 */
export const getProductWithVariants = async (
  slug: string,
): Promise<{ product: Product | null; variants: Product[] }> => {
  const product = await getProductBySlug(slug)
  if (!product) {
    return { product: null, variants: [] }
  }

  const { baseName } = getProductVariantMeta(product)
  const client = getSupabase()

  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('main_category', product.main_category)
    .ilike('name', `${escapeLikePattern(baseName)}%`)
    .order('created_at', { ascending: false })

  if (error) {
    // Une variante manquante ne doit pas empecher d'afficher la fiche.
    console.error('[hotgyaal] chargement des déclinaisons impossible', error)
    return { product, variants: [product] }
  }

  // `ilike` ramene aussi les noms qui commencent pareil sans etre des
  // declinaisons ("Top Azur Long" face a "Top Azur") : on ne garde que
  // celles dont la base correspond exactement.
  const variants = ((data ?? []) as Product[])
    .map(normalizeProduct)
    .filter((candidate) => getProductVariantMeta(candidate).baseName === baseName)

  return { product, variants: variants.length ? variants : [product] }
}

export const upsertProduct = async (
  payload: ProductPayload,
  productId?: string,
): Promise<Product> => {
  const client = getSupabase()

  const query = productId
    ? client.from('products').update(payload).eq('id', productId)
    : client.from('products').insert(payload)

  const { data, error } = await query.select().single()

  if (error) {
    throw new Error(error.message)
  }

  const normalized = normalizeProduct(data as Product)
  clearProductsCache()
  return normalized
}

export const removeProduct = async (productId: string): Promise<void> => {
  const client = getSupabase()
  const { error } = await client.from('products').delete().eq('id', productId)

  if (error) {
    throw new Error(error.message)
  }

  clearProductsCache()
}

export const uploadProductImage = async (file: File): Promise<string> => {
  try {
    return await uploadToR2(file, 'products')
  } catch (error) {
    // Repli sur le stockage Supabase tant que R2 n'est pas configure.
    if (!(error instanceof StorageNotConfiguredError)) {
      throw error
    }
  }

  const client = getSupabase()
  const optimized = await compressImageFile(file)
  const extension = optimized.name.split('.').pop() ?? 'jpg'
  const filePath = `products/${createFileToken()}.${extension}`

  const { error: uploadError } = await client.storage
    .from(PRODUCT_BUCKET)
    .upload(filePath, optimized, {
      upsert: false,
      cacheControl: '3600',
    })

  if (uploadError) {
    const loweredMessage = uploadError.message.toLowerCase()

    if (loweredMessage.includes('bucket')) {
      throw new Error(
        'Bucket Supabase product-images introuvable. Lancez le SQL setup Supabase.',
      )
    }

    if (
      loweredMessage.includes('permission') ||
      loweredMessage.includes('not allowed') ||
      loweredMessage.includes('row-level')
    ) {
      throw new Error(
        'Permission Storage insuffisante. Appliquez les policies Supabase du projet.',
      )
    }

    throw new Error(uploadError.message)
  }

  const { data } = client.storage.from(PRODUCT_BUCKET).getPublicUrl(filePath)
  if (!data.publicUrl) {
    throw new Error('Public image URL is missing.')
  }

  return data.publicUrl
}
