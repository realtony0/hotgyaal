import { CATEGORY_TREE } from '../constants/categories'
import { getSupabase } from '../lib/supabase'
import type { StoreCategory, StoreCategoryPayload } from '../types'

const CATEGORY_BUCKET = 'product-images'
const MISSING_TABLE_CODE = '42P01'
const MISSING_TABLE_SCHEMA_CACHE_CODE = 'PGRST205'
const createFileToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizeCategory = (raw: StoreCategory): StoreCategory => {
  const subcategories = Array.from(
    new Set(
      (Array.isArray(raw.subcategories) ? raw.subcategories : [])
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )

  return {
    ...raw,
    subcategories,
    image_url: raw.image_url || null,
    description: raw.description?.trim() || 'Categorie HOTGYAAL',
    display_order:
      typeof raw.display_order === 'number' ? raw.display_order : Number.MAX_SAFE_INTEGER,
    is_active: raw.is_active !== false,
  }
}

const createFallbackCategories = (): StoreCategory[] => {
  const now = new Date().toISOString()
  return CATEGORY_TREE.map((category, index) =>
    normalizeCategory({
      id: `fallback-${index + 1}`,
      slug: category.slug,
      name: category.name,
      description: category.description,
      image_url: null,
      subcategories: category.subcategories,
      is_active: true,
      display_order: index,
      created_at: now,
      updated_at: now,
    }),
  )
}

const isMissingCategoriesTableError = (error: { code?: string; message?: string }) => {
  const code = error.code || ''
  const message = (error.message || '').toLowerCase()

  return (
    code === MISSING_TABLE_CODE ||
    code === MISSING_TABLE_SCHEMA_CACHE_CODE ||
    (message.includes('could not find the table') &&
      message.includes('store_categories'))
  )
}

export const listCategories = async (): Promise<StoreCategory[]> => {
  const client = getSupabase()
  const { data, error } = await client
    .from('store_categories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingCategoriesTableError(error)) {
      return createFallbackCategories()
    }
    throw new Error(error.message)
  }

  return ((data ?? []) as StoreCategory[]).map(normalizeCategory)
}

export const upsertCategory = async (
  payload: StoreCategoryPayload,
  categoryId?: string,
): Promise<StoreCategory> => {
  const client = getSupabase()

  const query = categoryId
    ? client.from('store_categories').update(payload).eq('id', categoryId)
    : client.from('store_categories').insert(payload)

  const { data, error } = await query.select('*').single()

  if (error) {
    if (isMissingCategoriesTableError(error)) {
      throw new Error(
        'Table store_categories manquante. Lancez le SQL full_setup.sql mis a jour.',
      )
    }

    throw new Error(error.message)
  }

  return normalizeCategory(data as StoreCategory)
}

export const removeCategory = async (categoryId: string): Promise<void> => {
  const client = getSupabase()
  const { error } = await client.from('store_categories').delete().eq('id', categoryId)

  if (error) {
    if (isMissingCategoriesTableError(error)) {
      throw new Error(
        'Table store_categories manquante. Lancez le SQL full_setup.sql mis a jour.',
      )
    }

    throw new Error(error.message)
  }
}

export const uploadCategoryImage = async (file: File): Promise<string> => {
  const client = getSupabase()
  const extension = file.name.split('.').pop() ?? 'jpg'
  const filePath = `categories/${createFileToken()}.${extension}`

  const { error: uploadError } = await client.storage
    .from(CATEGORY_BUCKET)
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

  const { data } = client.storage.from(CATEGORY_BUCKET).getPublicUrl(filePath)
  if (!data.publicUrl) {
    throw new Error('Public image URL is missing.')
  }

  return data.publicUrl
}
