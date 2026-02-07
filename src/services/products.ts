import { getSupabase } from '../lib/supabase'
import type { Product, ProductPayload } from '../types'

const PRODUCT_BUCKET = 'product-images'
const DEFAULT_SIZE = 'Taille unique'

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

export const listProducts = async (): Promise<Product[]> => {
  const client = getSupabase()
  const { data, error } = await client
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as Product[]).map(normalizeProduct)
}

export const getProductBySlug = async (slug: string): Promise<Product | null> => {
  const client = getSupabase()
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return normalizeProduct(data as Product)
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

  return normalizeProduct(data as Product)
}

export const removeProduct = async (productId: string): Promise<void> => {
  const client = getSupabase()
  const { error } = await client.from('products').delete().eq('id', productId)

  if (error) {
    throw new Error(error.message)
  }
}

export const uploadProductImage = async (file: File): Promise<string> => {
  const client = getSupabase()
  const extension = file.name.split('.').pop() ?? 'jpg'
  const filePath = `products/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await client.storage
    .from(PRODUCT_BUCKET)
    .upload(filePath, file, {
      upsert: false,
      cacheControl: '3600',
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data } = client.storage.from(PRODUCT_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}
