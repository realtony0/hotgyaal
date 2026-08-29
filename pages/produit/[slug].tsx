import type { GetServerSideProps } from 'next'
import { LOCAL_PRODUCTS } from '../../src/data/localProducts'
import { isSupabaseConfigured } from '../../src/lib/supabase'
import { ProductPage } from '../../src/pages/ProductPage'
import { getProductWithVariants } from '../../src/services/products'
import type { Product } from '../../src/types'

type ProductRouteProps = {
  initialProduct: Product
  initialVariants: Product[]
}

const normalizeSlug = (value: string) => value.trim().toLowerCase()

const resolveFromLocal = (slug: string) => {
  const product =
    LOCAL_PRODUCTS.find((item) => normalizeSlug(item.slug) === normalizeSlug(slug)) ?? null
  return { product, variants: product ? [product] : [] }
}

export const getServerSideProps: GetServerSideProps<ProductRouteProps> = async ({
  params,
}) => {
  const slugParam = params?.slug
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam

  if (!slug) {
    return { notFound: true }
  }

  let resolved: { product: Product | null; variants: Product[] }

  if (!isSupabaseConfigured) {
    resolved = resolveFromLocal(slug)
  } else {
    try {
      resolved = await getProductWithVariants(normalizeSlug(slug))
      if (!resolved.product) {
        resolved = resolveFromLocal(slug)
      }
    } catch {
      resolved = resolveFromLocal(slug)
    }
  }

  if (!resolved.product) {
    return { notFound: true }
  }

  return {
    props: {
      initialProduct: resolved.product,
      initialVariants: resolved.variants,
    },
  }
}

export default function Product({ initialProduct, initialVariants }: ProductRouteProps) {
  return (
    <ProductPage initialProduct={initialProduct} initialVariants={initialVariants} />
  )
}
