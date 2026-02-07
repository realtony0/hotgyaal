import type { Product } from '../types'

// Keep first occurrence per slug to avoid duplicated listings.
export const dedupeProductsBySlug = (products: Product[]): Product[] => {
  const seen = new Set<string>()
  const unique: Product[] = []

  for (const product of products) {
    const key = product.slug || product.id
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push(product)
  }

  return unique
}

type ProductVariantMeta = {
  baseName: string
  color: string | null
}

export const getProductVariantMeta = (product: Product): ProductVariantMeta => {
  const separator = ' - '
  if (!product.name.includes(separator)) {
    return { baseName: product.name.trim(), color: null }
  }

  const parts = product.name.split(separator).map((part) => part.trim())
  if (parts.length < 2) {
    return { baseName: product.name.trim(), color: null }
  }

  const color = parts.pop() ?? null
  const baseName = parts.join(separator).trim()

  if (!baseName || !color) {
    return { baseName: product.name.trim(), color: null }
  }

  return { baseName, color }
}

const getStorefrontGroupKey = (product: Product) => {
  const variant = getProductVariantMeta(product)
  return `${variant.baseName.toLowerCase()}::${product.main_category}::${product.sub_category}`
}

export const groupProductsForStorefront = (products: Product[]): Product[] => {
  const sorted = dedupeProductsBySlug(products).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  )

  const groups = new Map<string, Product[]>()

  for (const product of sorted) {
    const key = getStorefrontGroupKey(product)
    const current = groups.get(key) ?? []
    current.push(product)
    groups.set(key, current)
  }

  return Array.from(groups.values()).map((group) => {
    const primary = group[0]
    const primaryMeta = getProductVariantMeta(primary)

    const imagePool = Array.from(
      new Set(
        group.flatMap((item) =>
          [item.image_url, ...(item.gallery_urls ?? [])].filter(Boolean),
        ) as string[],
      ),
    )

    return {
      ...primary,
      name: primaryMeta.baseName,
      image_url: imagePool[0] ?? primary.image_url,
      gallery_urls: imagePool.slice(1),
      sizes: Array.from(
        new Set(
          group.flatMap((item) =>
            (item.sizes ?? []).map((size) => size.trim()).filter(Boolean),
          ),
        ),
      ),
      is_out_of_stock: group.every((item) => item.is_out_of_stock),
      stock: group.reduce((sum, item) => sum + item.stock, 0),
      is_new: group.some((item) => item.is_new),
      is_best_seller: group.some((item) => item.is_best_seller),
    }
  })
}

export const getRelatedVariants = (
  products: Product[],
  target: Product,
): Product[] => {
  const targetMeta = getProductVariantMeta(target)
  const targetKey = `${targetMeta.baseName.toLowerCase()}::${target.main_category}::${target.sub_category}`

  const related = dedupeProductsBySlug(products)
    .filter((product) => getStorefrontGroupKey(product) === targetKey)
    .sort((a, b) => a.name.localeCompare(b.name))

  return related
}
