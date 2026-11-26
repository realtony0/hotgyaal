import type { GetServerSideProps } from 'next'
import { isSupabaseConfigured } from '../../src/lib/supabase'
import { ProductPage } from '../../src/pages/ProductPage'
import { getProductWithVariants } from '../../src/services/products'
import type { Product } from '../../src/types'

type ProductRouteProps = {
  initialProduct: Product | null
  initialVariants: Product[]
}

const normalizeSlug = (value: string) => value.trim().toLowerCase()

export const getServerSideProps: GetServerSideProps<ProductRouteProps> = async ({
  params,
}) => {
  const slugParam = params?.slug
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam

  if (!slug) {
    return { notFound: true }
  }

  /*
   * Quand la base est injoignable, on rend la page sans produit plutot que de
   * presenter un article de substitution : le client recharge la fiche et
   * affiche un message clair s'il n'y arrive pas non plus. Mieux vaut une page
   * en attente qu'un faux produit.
   */
  if (!isSupabaseConfigured) {
    return { props: { initialProduct: null, initialVariants: [] } }
  }

  try {
    const { product, variants } = await getProductWithVariants(normalizeSlug(slug))

    // Base joignable et slug inconnu : c'est une vraie page inexistante.
    if (!product) {
      return { notFound: true }
    }

    return { props: { initialProduct: product, initialVariants: variants } }
  } catch (error) {
    console.error('[hotgyaal] fiche produit indisponible au rendu serveur', error)
    return { props: { initialProduct: null, initialVariants: [] } }
  }
}

export default function Product({ initialProduct, initialVariants }: ProductRouteProps) {
  return (
    <ProductPage initialProduct={initialProduct} initialVariants={initialVariants} />
  )
}
