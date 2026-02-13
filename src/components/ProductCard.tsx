import Link from 'next/link'
import { formatCurrency } from '../utils/format'
import type { Product } from '../types'

type ProductCardProps = {
  product: Product
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const savings = product.compare_price
    ? Math.max(0, product.compare_price - product.price)
    : 0
  const imageCount = (product.gallery_urls?.length ?? 0) + (product.image_url ? 1 : 0)

  return (
    <article className="product-card-v2">
      <Link href={`/produit/${product.slug}`} className="product-card-v2__media">
        <img
          src={
            product.image_url ||
            'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80'
          }
          alt={product.name}
          loading="lazy"
          decoding="async"
        />

        <div className="product-card-v2__badges">
          {product.is_new ? <span>Nouveau</span> : null}
          {product.is_best_seller ? <span>Best seller</span> : null}
          {product.is_out_of_stock ? <span className="is-dark">Rupture</span> : null}
        </div>
      </Link>

      <div className="product-card-v2__body">
        <p className="product-card-v2__category">
          {product.main_category} · {product.sub_category}
        </p>

        <Link href={`/produit/${product.slug}`} className="product-card-v2__title">
          {product.name}
        </Link>

        <div className="product-card-v2__price">
          <strong>{formatCurrency(product.price)}</strong>
          {product.compare_price ? <span>{formatCurrency(product.compare_price)}</span> : null}
        </div>

        {savings > 0 ? (
          <p className="product-card-v2__save">Economie {formatCurrency(savings)}</p>
        ) : (
          <p className="product-card-v2__save">Prix catalogue HOTGYAAL</p>
        )}

        <div className="product-card-v2__foot">
          <span>{product.sizes.length ? `${product.sizes.length} tailles` : 'Taille unique'}</span>
          {imageCount > 1 ? <span>{imageCount} photos</span> : null}
          <Link href={`/produit/${product.slug}`}>
            Voir
          </Link>
        </div>
      </div>
    </article>
  )
}
