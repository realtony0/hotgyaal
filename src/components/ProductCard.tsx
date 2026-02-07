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

  return (
    <article className="product-card">
      <Link href={`/produit/${product.slug}`} className="product-card__media">
        <img
          src={product.image_url || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80'}
          alt={product.name}
          loading="lazy"
          decoding="async"
        />
        <div className="product-card__badges">
          {product.is_new ? <span className="badge">Nouveau</span> : null}
          {product.is_out_of_stock ? (
            <span className="badge badge--dark">Épuisé</span>
          ) : null}
          {product.compare_price ? (
            <span className="badge badge--contrast">Promotion</span>
          ) : null}
          {product.is_best_seller ? <span className="badge">Best Seller</span> : null}
        </div>
      </Link>

      <div className="product-card__body">
        <div className="product-card__meta">
          <p>{product.main_category}</p>
          <span>{product.sub_category}</span>
        </div>

        <Link href={`/produit/${product.slug}`} className="product-card__title">
          {product.name}
        </Link>

        <div className="product-card__price">
          <strong>{formatCurrency(product.price)}</strong>
          {product.compare_price ? (
            <span>{formatCurrency(product.compare_price)}</span>
          ) : null}
        </div>

        {savings > 0 ? (
          <p className="product-card__saving">Vous économisez {formatCurrency(savings)}</p>
        ) : null}

        <Link href={`/produit/${product.slug}`} className="product-card__cta">
          Voir la fiche
        </Link>
      </div>
    </article>
  )
}
