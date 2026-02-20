import { getSupabase } from '../lib/supabase'
import type { Product, ProductPayload } from '../types'

const PRODUCT_BUCKET = 'product-images'
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
    .select('*')
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

  const products = await listProducts()
  return (
    products.find((product) => product.slug.trim().toLowerCase() === normalizedSlug) ??
    null
  )
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
  const client = getSupabase()
  const extension = file.name.split('.').pop() ?? 'jpg'
  const filePath = `products/${createFileToken()}.${extension}`

  const { error: uploadError } = await client.storage
    .from(PRODUCT_BUCKET)
    .upload(filePath, file, {
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
