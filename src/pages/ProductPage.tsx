import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCart } from '../context/CartContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { listProducts } from '../services/products'
import type { Product } from '../types'
import { formatCurrency } from '../utils/format'
import { getProductVariantMeta, getRelatedVariants } from '../utils/products'

export const ProductPage = () => {
  const router = useRouter()
  const slugParam = router.query.slug
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam

  const { addToCart } = useCart()

  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<Product[]>([])
  const [selectedSize, setSelectedSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const normalizeSlug = (value: string) => value.trim().toLowerCase()

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

      if (!isSupabaseConfigured) {
        setLoading(false)
        setError(
          "Supabase n'est pas configure. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
        )
        return
      }

      const normalizedSlug = normalizeSlug(slug)
      const inMemoryVariant = variants.find(
        (variant) => normalizeSlug(variant.slug) === normalizedSlug,
      )

      if (inMemoryVariant) {
        setProduct(inMemoryVariant)
        setActiveImage(inMemoryVariant.image_url)
        setError(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const allProducts = await listProducts()
        const data =
          allProducts.find((item) => normalizeSlug(item.slug) === normalizedSlug) ??
          null

        if (!data) {
          setProduct(null)
          setError('Produit introuvable.')
          return
        }

        setProduct(data)
        setVariants(getRelatedVariants(allProducts, data))
        setActiveImage(data.image_url)
        setError(null)
      } catch (loadError) {
        setProduct(null)
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger ce produit depuis Supabase.',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadProduct()
  }, [router.isReady, slug, variants])

  const gallery = useMemo(() => {
    if (!product) {
      return []
    }

    const imagePool = [product.image_url, ...(product.gallery_urls ?? [])].filter(
      Boolean,
    ) as string[]

    return Array.from(new Set(imagePool))
  }, [product])

  const availableSizes = useMemo(() => {
    if (!product) {
      return []
    }

    const cleaned = (product.sizes ?? []).map((size) => size.trim()).filter(Boolean)
    return cleaned.length ? Array.from(new Set(cleaned)) : ['Taille unique']
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

  const productMeta = useMemo(
    () => (product ? getProductVariantMeta(product) : null),
    [product],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || variants.length === 0) {
      return
    }

    const urls = Array.from(
      new Set(
        variants.flatMap((variant) =>
          [variant.image_url, ...(variant.gallery_urls ?? [])].filter(Boolean),
        ) as string[],
      ),
    )

    urls.forEach((url) => {
      const image = new window.Image()
      image.decoding = 'async'
      image.src = url
    })
  }, [variants])

  const handleVariantChange = (variant: Product) => {
    if (!product || variant.id === product.id) {
      return
    }

    setProduct(variant)
    setActiveImage(variant.image_url)
    setFeedback(null)
    setQuantity(1)

    void router.replace(`/produit/${variant.slug}`, undefined, {
      shallow: true,
      scroll: false,
    })
  }

  const handleAddToCart = () => {
    if (!product) {
      return
    }

    if (product.is_out_of_stock) {
      setFeedback('Article temporairement en rupture.')
      return
    }

    const size = selectedSize || availableSizes[0] || 'Taille unique'
    addToCart(product, size, quantity)
    setFeedback(`${quantity} article(s) ajoute(s), taille ${size}.`)
  }

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <p>Chargement du produit...</p>
        </div>
      </section>
    )
  }

  if (error || !product) {
    return (
      <section className="section">
        <div className="container">
          <p className="error-text">{error ?? 'Produit introuvable.'}</p>
          <Link href="/boutique" className="button">
            Retour au catalogue
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="section product-page-v2">
      <div className="container product-detail-v2">
        <div className="product-detail-v2__gallery">
          <div className="product-detail-v2__cover">
            <img
              src={
                activeImage ||
                'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'
              }
              alt={product.name}
              decoding="async"
              fetchPriority="high"
            />
          </div>

          {gallery.length > 1 ? (
            <div className="product-detail-v2__thumbs">
              {gallery.map((imageUrl) => (
                <button
                  type="button"
                  key={imageUrl}
                  className={
                    imageUrl === activeImage
                      ? 'product-detail-v2__thumb is-active'
                      : 'product-detail-v2__thumb'
                  }
                  onClick={() => setActiveImage(imageUrl)}
                >
                  <img src={imageUrl} alt={product.name} loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="product-detail-v2__info">
          <p className="eyebrow">{product.main_category}</p>
          <h1>{productMeta?.baseName ?? product.name}</h1>
          <p className="product-detail-v2__sub">{product.sub_category}</p>

          <div className="product-detail-v2__price">
            <strong>{formatCurrency(product.price)}</strong>
            {product.compare_price ? <span>{formatCurrency(product.compare_price)}</span> : null}
          </div>

          <p className="product-detail-v2__description">{product.description}</p>

          {variants.length > 1 ? (
            <div className="variant-switcher">
              <p className="variant-switcher__label">Coloris disponibles</p>
              <div className="variant-switcher__list">
                {variants.map((variant) => {
                  const meta = getProductVariantMeta(variant)
                  return (
                    <button
                      type="button"
                      key={variant.id}
                      className={variant.id === product.id ? 'chip chip--active' : 'chip'}
                      onClick={() => handleVariantChange(variant)}
                    >
                      {meta.color || 'Standard'}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

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

          <div className="product-detail-v2__actions">
            <label>
              Quantite
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
              {product.is_out_of_stock ? 'Rupture de stock' : 'Ajouter au panier'}
            </button>
            <Link href="/panier" className="button button--ghost">
              Aller au panier
            </Link>
          </div>

          {feedback ? <p className="success-text">{feedback}</p> : null}
        </div>
      </div>
    </section>
  )
}
