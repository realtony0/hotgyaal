import type { GetServerSideProps } from 'next'
import { LOCAL_PRODUCTS } from '../../src/data/localProducts'
import { isSupabaseConfigured } from '../../src/lib/supabase'
import { ProductPage } from '../../src/pages/ProductPage'
import { listProducts } from '../../src/services/products'
import type { Product } from '../../src/types'
import { getRelatedVariants } from '../../src/utils/products'

type ProductRouteProps = {
  initialProduct: Product
  initialVariants: Product[]
}

const normalizeSlug = (value: string) => value.trim().toLowerCase()

const resolveProducts = async (): Promise<Product[]> => {
  if (!isSupabaseConfigured) {
    return LOCAL_PRODUCTS
  }

  try {
    const products = await listProducts({ forceFresh: true })
    return products.length ? products : LOCAL_PRODUCTS
  } catch {
    return LOCAL_PRODUCTS
  }
}

export const getServerSideProps: GetServerSideProps<ProductRouteProps> = async ({
  params,
}) => {
  const slugParam = params?.slug
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam

  if (!slug) {
    return { notFound: true }
  }

  const products = await resolveProducts()
  const product =
    products.find((item) => normalizeSlug(item.slug) === normalizeSlug(slug)) ?? null

  if (!product) {
    return { notFound: true }
  }

  return {
    props: {
      initialProduct: product,
      initialVariants: getRelatedVariants(products, product),
    },
  }
}

export default function Product({ initialProduct, initialVariants }: ProductRouteProps) {
  return (
    <ProductPage initialProduct={initialProduct} initialVariants={initialVariants} />
  )
}
