import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCart } from '../context/CartContext'
import { getLocalProductBySlug, LOCAL_PRODUCTS } from '../data/localProducts'
import { isSupabaseConfigured } from '../lib/supabase'
import { getProductBySlug, listProducts } from '../services/products'
import type { Product } from '../types'
import { formatCurrency } from '../utils/format'
import { getProductVariantMeta, getRelatedVariants } from '../utils/products'

export const ProductPage = () => {
  const router = useRouter()
  const slugParam = router.query.slug
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam
  const [product, setProduct] = useState<Product | null>(null)
  const [relatedVariants, setRelatedVariants] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedSize, setSelectedSize] = useState('')
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const { addToCart } = useCart()

  useEffect(() => {
    const loadProduct = async () => {
      if (!router.isReady) {
        return
      }

      if (!slug) {
        setLoading(false)
        setError('Produit introuvable.')
        return
      }

      try {
        setLoading(true)

        if (!isSupabaseConfigured) {
          const localProduct = getLocalProductBySlug(slug)
          if (!localProduct) {
            setError('Produit introuvable.')
            setProduct(null)
            return
          }

          setProduct(localProduct)
          setRelatedVariants(getRelatedVariants(LOCAL_PRODUCTS, localProduct))
          setActiveImage(localProduct.image_url)
          setError(null)
          return
        }

        const data = await getProductBySlug(slug)

        if (!data) {
          setError('Produit introuvable.')
          setProduct(null)
          return
        }

        const allProducts = await listProducts()

        setProduct(data)
        setRelatedVariants(getRelatedVariants(allProducts, data))
        setActiveImage(data.image_url)
        setError(null)
      } catch (loadError) {
        const localProduct = getLocalProductBySlug(slug)
        if (localProduct) {
          setProduct(localProduct)
          setRelatedVariants(getRelatedVariants(LOCAL_PRODUCTS, localProduct))
          setActiveImage(localProduct.image_url)
          setError(null)
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger ce produit.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [router.isReady, slug])

  const gallery = useMemo(() => {
    if (!product) {
      return []
    }

    const images = [product.image_url, ...(product.gallery_urls || [])].filter(
      Boolean,
    ) as string[]

    return Array.from(new Set(images))
  }, [product])

  const productMeta = useMemo(
    () => (product ? getProductVariantMeta(product) : null),
    [product],
  )

  const availableSizes = useMemo(() => {
    if (!product) {
      return []
    }

    const sizes = (product.sizes ?? []).map((size) => size.trim()).filter(Boolean)
    return sizes.length ? Array.from(new Set(sizes)) : ['Taille unique']
  }, [product])

  useEffect(() => {
    if (!availableSizes.length) {
      setSelectedSize('')
      return
    }

    setSelectedSize((current) =>
      current && availableSizes.includes(current) ? current : availableSizes[0],
    )
  }, [availableSizes])

  const handleAddToCart = () => {
    if (!product) {
      return
    }

    if (product.is_out_of_stock) {
      setFeedback('Article indisponible pour le moment.')
      return
    }

    const size = selectedSize || availableSizes[0] || 'Taille unique'
    addToCart(product, size, quantity)
    setFeedback(`${quantity} article(s) ajouté(s) - taille ${size}.`)
  }

  if (loading) {
    return (
      <div className="section">
        <div className="container">
          <p>Chargement du produit...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="section">
        <div className="container">
          <p className="error-text">{error ?? 'Produit introuvable.'}</p>
          <Link href="/boutique" className="button">
            Retour à la boutique
          </Link>
        </div>
      </div>
    )
  }

  return (
    <section className="section">
      <div className="container product-detail">
        <div>
          <div className="product-detail__hero-image">
            <img
              src={
                activeImage ||
                'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'
              }
              alt={product.name}
            />
          </div>

          {gallery.length > 1 ? (
            <div className="product-detail__thumbs">
              {gallery.map((imageUrl) => (
                <button
                  type="button"
                  key={imageUrl}
                  className={
                    imageUrl === activeImage ? 'thumb is-active' : 'thumb'
                  }
                  onClick={() => setActiveImage(imageUrl)}
                >
                  <img src={imageUrl} alt={product.name} loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="product-detail__info">
          <p className="eyebrow">{product.main_category}</p>
          <h1>{productMeta?.baseName ?? product.name}</h1>
          <p>{product.sub_category}</p>

          {relatedVariants.length > 1 ? (
            <div className="variant-switcher">
              <p className="variant-switcher__label">Couleurs disponibles</p>
              <div className="variant-switcher__list">
                {relatedVariants.map((variant) => {
                  const meta = getProductVariantMeta(variant)
                  return (
                    <Link
                      key={variant.slug}
                      href={`/produit/${variant.slug}`}
                      className={
                        variant.slug === product.slug ? 'chip chip--active' : 'chip'
                      }
                    >
                      {meta.color ?? 'Standard'}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="product-card__price product-detail__price">
            <strong>{formatCurrency(product.price)}</strong>
            {product.compare_price ? (
              <span>{formatCurrency(product.compare_price)}</span>
            ) : null}
          </div>

          <p className="product-detail__description">{product.description}</p>

          <div className="size-selector">
            <p className="size-selector__label">Tailles</p>
            <div className="size-selector__list">
              {availableSizes.map((size) => (
                <button
                  type="button"
                  key={size}
                  className={size === selectedSize ? 'chip chip--active' : 'chip'}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="product-detail__actions">
            <label>
              Quantité
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>
            <button
              type="button"
              className="button"
              onClick={handleAddToCart}
              disabled={product.is_out_of_stock}
            >
              {product.is_out_of_stock ? 'Indisponible' : 'Ajouter au panier'}
            </button>
            <Link href="/panier" className="button button--ghost">
              Voir le panier
            </Link>
          </div>

          {feedback ? <p className="success-text">{feedback}</p> : null}
        </div>
      </div>
    </section>
  )
}
