import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '../context/CartContext'
import type { Product } from '../types'
import { formatCurrency } from '../utils/format'
import { getProductVariantMeta } from '../utils/products'
import { ColorSwatches } from './ColorSwatches'

type ProductCardProps = {
  product: Product
}

const MAX_NAME_WORDS = 6
const FALLBACK_SIZE = 'Taille unique'
const MAX_SWATCHES = 6

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

  /*
   * Une carte regroupe les coloris d'un meme modele. La pastille choisie
   * decide de la photo, du lien et de ce qui part au panier.
   */
  const variants = product.variants ?? []
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null)
  const active = selectedVariant ?? variants[0] ?? product

  const href = `/produit/${active.slug}`
  const imageUrl = active.image_url || product.image_url || '/placeholder-produit.svg'
  const activeColor = variants.length > 1 ? getProductVariantMeta(active).color : null

  const mainSize = (active.sizes[0] ?? product.sizes[0])?.trim() || FALLBACK_SIZE
  const isOutOfStock = variants.length > 1 ? active.is_out_of_stock : product.is_out_of_stock
  const price = active.price ?? product.price
  const comparePrice = active.compare_price ?? product.compare_price

  const hasDiscount = typeof comparePrice === 'number' && comparePrice > price
  const discountPercent = hasDiscount ? Math.round((1 - price / (comparePrice as number)) * 100) : 0

  /*
   * Une seule etiquette par carte, par ordre de priorite.
   * Empiler "Nouveau" et "Tendance" sur chaque produit vidait les deux de leur sens.
   */
  const badge = isOutOfStock
    ? { label: 'Rupture', tone: 'is-dark' }
    : hasDiscount
      ? { label: `-${discountPercent}%`, tone: 'is-sale' }
      : product.is_best_seller
        ? { label: 'Populaire', tone: 'is-trend' }
        : product.is_new && isRecent(product.created_at)
          ? { label: 'Nouveau', tone: '' }
          : null

  const handleQuickAdd = () => {
    if (isOutOfStock) {
      return
    }

    addToCart(variants.length > 1 ? active : product, mainSize, 1)
    setIsAdding(true)

    window.setTimeout(() => {
      setIsAdding(false)
    }, 320)
  }

  return (
    <article className="product-card-v2 product-card-v2--commerce">
      <Link href={href} className="product-card-v2__media" aria-label={product.name}>
        <img
          key={imageUrl}
          src={imageUrl}
          alt={activeColor ? `${product.name} - ${activeColor}` : product.name}
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
        <Link href={href} className="product-card-v2__title" title={product.name}>
          {shortenName(product.name)}
        </Link>

        {variants.length > 1 ? (
          <div className="product-card-v2__colors">
            <ColorSwatches
              variants={variants}
              activeId={active.id}
              onSelect={setSelectedVariant}
              limit={MAX_SWATCHES}
            />
            <span className="product-card-v2__color-name">{activeColor ?? ' '}</span>
          </div>
        ) : null}

        <div className="product-card-v2__price">
          <strong>{formatCurrency(price)}</strong>
          {hasDiscount ? (
            <span className="product-card-v2__compare">
              {formatCurrency(comparePrice as number)}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          className={isAdding ? 'product-card-v2__add is-added' : 'product-card-v2__add'}
          onClick={handleQuickAdd}
          disabled={isOutOfStock}
        >
          {isOutOfStock ? 'Rupture de stock' : 'Ajouter au panier'}
        </button>
      </div>
    </article>
  )
}
