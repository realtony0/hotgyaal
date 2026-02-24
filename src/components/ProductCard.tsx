import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '../context/CartContext'
import type { Product } from '../types'
import { formatCurrency } from '../utils/format'

type ProductCardProps = {
  product: Product
}

const MAX_NAME_WORDS = 6
const FALLBACK_SIZE = 'Taille unique'

const shortenName = (value: string) => {
  const words = value.trim().split(/\s+/)
  if (words.length <= MAX_NAME_WORDS) {
    return value
  }

  return `${words.slice(0, MAX_NAME_WORDS).join(' ')}...`
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart()
  const [isAdding, setIsAdding] = useState(false)

  const mainSize = product.sizes[0]?.trim() || FALLBACK_SIZE
  const primaryBadge = product.is_new
    ? 'New'
    : product.is_best_seller
      ? 'Populaire'
      : null

  const handleQuickAdd = () => {
    if (product.is_out_of_stock) {
      return
    }

    addToCart(product, mainSize, 1)
    setIsAdding(true)

    window.setTimeout(() => {
      setIsAdding(false)
    }, 320)
  }

  return (
    <article className="product-card-v2 product-card-v2--commerce">
      <Link href={`/produit/${product.slug}`} className="product-card-v2__media" aria-label={product.name}>
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
          {primaryBadge ? <span>{primaryBadge}</span> : null}
          {product.is_best_seller ? <span className="is-trend">Tendance au Senegal</span> : null}
          {product.is_out_of_stock ? <span className="is-dark">Rupture</span> : null}
        </div>
      </Link>

      <div className="product-card-v2__body">
        <Link href={`/produit/${product.slug}`} className="product-card-v2__title" title={product.name}>
          {shortenName(product.name)}
        </Link>

        <div className="product-card-v2__price">
          <strong>{formatCurrency(product.price)}</strong>
        </div>

        <button
          type="button"
          className={isAdding ? 'product-card-v2__add is-added' : 'product-card-v2__add'}
          onClick={handleQuickAdd}
          disabled={product.is_out_of_stock}
        >
          {product.is_out_of_stock ? 'Rupture de stock' : 'Ajouter au panier'}
        </button>
      </div>
    </article>
  )
}
