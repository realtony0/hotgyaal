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

/*
 * Le drapeau is_new est pose sur la quasi-totalite du catalogue, ce qui vide
 * l'etiquette de son sens. On la reserve donc aux fiches reellement recentes :
 * le drapeau doit etre actif ET la fiche avoir ete creee dans la fenetre
 * ci-dessous.
 */
const NEW_WINDOW_DAYS = 30

const isRecent = (createdAt: string | null | undefined) => {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

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

  const hasDiscount =
    typeof product.compare_price === 'number' && product.compare_price > product.price
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / (product.compare_price as number)) * 100)
    : 0

  /*
   * Une seule etiquette par carte, par ordre de priorite.
   * Empiler "Nouveau" et "Tendance" sur chaque produit vidait les deux de leur sens.
   */
  const badge = product.is_out_of_stock
    ? { label: 'Rupture', tone: 'is-dark' }
    : hasDiscount
      ? { label: `-${discountPercent}%`, tone: 'is-sale' }
      : product.is_best_seller
        ? { label: 'Populaire', tone: 'is-trend' }
        : product.is_new && isRecent(product.created_at)
          ? { label: 'Nouveau', tone: '' }
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
            '/placeholder-produit.svg'
          }
          alt={product.name}
          loading="lazy"
          decoding="async"
        />

        {badge ? (
          <div className="product-card-v2__badges">
            <span className={badge.tone}>{badge.label}</span>
          </div>
        ) : null}
      </Link>

      <div className="product-card-v2__body">
        <Link href={`/produit/${product.slug}`} className="product-card-v2__title" title={product.name}>
          {shortenName(product.name)}
        </Link>

        <div className="product-card-v2__price">
          <strong>{formatCurrency(product.price)}</strong>
          {hasDiscount ? (
            <span className="product-card-v2__compare">
              {formatCurrency(product.compare_price as number)}
            </span>
          ) : null}
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
