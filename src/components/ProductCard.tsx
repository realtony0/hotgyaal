import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '../context/CartContext'
import {
  describeGalleryColor,
  useGalleryColorIndex,
  useGalleryColors,
} from '../services/galleryColors'
import type { Product } from '../types'
import { formatCurrency } from '../utils/format'
import { getProductVariantMeta } from '../utils/products'
import { ColorSwatches } from './ColorSwatches'
import { GalleryColorPicker } from './GalleryColorPicker'

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

/* Vrai une fois que l'element est entre dans l'ecran (ou presque). */
const useSeenOnce = <T extends Element>() => {
  const ref = useRef<T | null>(null)
  // Sans IntersectionObserver (vieux navigateurs), on charge tout de suite.
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const node = ref.current
    if (!node || seen) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [seen])

  return { ref, seen }
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart()
  const [isAdding, setIsAdding] = useState(false)
  const { ref, seen } = useSeenOnce<HTMLElement>()

  /*
   * Deux facons d'avoir plusieurs coloris :
   * - des fiches distinctes "Modele - Couleur", regroupees sur une carte ;
   * - une seule fiche dont chaque photo de la galerie est un coloris.
   */
  const variants = product.variants ?? []
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null)
  const active = selectedVariant ?? variants[0] ?? product

  const colorIndex = useGalleryColorIndex()
  const galleryCount = variants.length > 1 ? 0 : (colorIndex[product.id]?.count ?? 0)
  const hasGalleryColors = galleryCount >= 2
  const { data: galleryColors, loading: galleryColorsLoading } = useGalleryColors(
    product.id,
    product.updated_at,
    hasGalleryColors && seen,
  )
  const [galleryIndex, setGalleryIndex] = useState(0)
  const galleryColor = hasGalleryColors ? (galleryColors?.colors[galleryIndex] ?? null) : null

  const href =
    hasGalleryColors && galleryIndex > 0
      ? `/produit/${product.slug}?coloris=${galleryIndex + 1}`
      : `/produit/${active.slug}`
  const imageUrl =
    galleryColor?.url || active.image_url || product.image_url || '/placeholder-produit.svg'
  const activeColor = variants.length > 1 ? getProductVariantMeta(active).color : galleryColor?.name

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

    // Ajout rapide : le coloris affiche sur la carte est celui qui part au panier.
    const color = hasGalleryColors
      ? {
          index: galleryIndex,
          label: describeGalleryColor(galleryIndex, galleryColor?.name),
          image_url: galleryColor?.url || product.image_url || '',
          hex: galleryColor?.hex ?? null,
        }
      : null

    addToCart(variants.length > 1 ? active : product, mainSize, 1, color)
    setIsAdding(true)

    window.setTimeout(() => {
      setIsAdding(false)
    }, 320)
  }

  const showGalleryPicker =
    hasGalleryColors && !galleryColorsLoading && galleryColors?.mode === 'couleurs'

  return (
    <article ref={ref} className="product-card-v2 product-card-v2--commerce">
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

        {hasGalleryColors ? (
          <div className="product-card-v2__colors">
            {showGalleryPicker ? (
              <GalleryColorPicker
                images={galleryColors.colors.map((color) => color.url)}
                data={galleryColors}
                loading={false}
                activeIndex={galleryIndex}
                onSelect={setGalleryIndex}
                size="sm"
                limit={MAX_SWATCHES}
              />
            ) : null}
            <span className="product-card-v2__color-name">
              {showGalleryPicker && galleryColor?.name
                ? galleryColor.name
                : `${galleryCount} coloris`}
            </span>
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
