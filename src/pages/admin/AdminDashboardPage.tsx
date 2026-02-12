import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  CATEGORY_TREE,
  MAIN_CATEGORY_NAMES,
  getSubcategoriesByMainCategory,
} from '../../constants/categories'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listOrders, updateOrderStatus } from '../../services/orders'
import {
  listProducts,
  removeProduct,
  upsertProduct,
  uploadProductImage,
} from '../../services/products'
import type { Order, OrderStatus, Product, ProductPayload } from '../../types'
import { formatCurrency, formatDate } from '../../utils/format'
import { toSlug } from '../../utils/slug'
import { dedupeProductsBySlug } from '../../utils/products'

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

type CategoryOption = {
  key: string
  label: string
  main: string
  sub: string
}

const CATEGORY_OPTIONS: CategoryOption[] = CATEGORY_TREE.flatMap((category) =>
  category.subcategories.map((subCategory) => ({
    key: `${category.name}|||${subCategory}`,
    label: `${category.name} > ${subCategory}`,
    main: category.name,
    sub: subCategory,
  })),
)

const FALLBACK_CATEGORY: CategoryOption = {
  key: 'Vêtements Femmes|||Robes',
  label: 'Vêtements Femmes > Robes',
  main: 'Vêtements Femmes',
  sub: 'Robes',
}

const DEFAULT_CATEGORY_KEY =
  CATEGORY_OPTIONS.find(
    (option) =>
      option.main === 'Vêtements Femmes' && option.sub === 'Robes',
  )?.key ?? CATEGORY_OPTIONS[0]?.key ?? FALLBACK_CATEGORY.key

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Taille unique']
const DEFAULT_SIZES = ['S', 'M', 'L', 'XL']

type ProductForm = {
  name: string
  slug: string
  description: string
  price: string
  compare_price: string
  sizes: string
  categoryKey: string
  image_url: string
  gallery_urls: string
  is_out_of_stock: boolean
  is_new: boolean
  is_best_seller: boolean
}

type ColorVariantDraft = {
  id: string
  color: string
  image_urls: string
  files: File[]
}

const INITIAL_FORM: ProductForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  compare_price: '',
  sizes: DEFAULT_SIZES.join(', '),
  categoryKey: DEFAULT_CATEGORY_KEY,
  image_url: '',
  gallery_urls: '',
  is_out_of_stock: false,
  is_new: true,
  is_best_seller: false,
}

const createColorVariant = (): ColorVariantDraft => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  color: '',
  image_urls: '',
  files: [],
})

const parseGalleryUrls = (raw: string): string[] =>
  raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const parseSizes = (raw: string): string[] =>
  Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )

const formatSizes = (sizes: string[]): string => sizes.join(', ')

const getCategoryFromKey = (categoryKey: string): CategoryOption =>
  CATEGORY_OPTIONS.find((option) => option.key === categoryKey) ??
  CATEGORY_OPTIONS[0] ??
  FALLBACK_CATEGORY

const getCategoryKeyFromProduct = (product: Product): string => {
  const option = CATEGORY_OPTIONS.find(
    (entry) =>
      entry.main === product.main_category && entry.sub === product.sub_category,
  )

  return option?.key ?? DEFAULT_CATEGORY_KEY
}

const buildUniqueSlug = (baseSlug: string, usedSlugs: Set<string>): string => {
  let candidate = baseSlug
  let index = 2
  while (usedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${index}`
    index += 1
  }
  usedSlugs.add(candidate)
  return candidate
}

export const AdminDashboardPage = () => {
  const { signOut, profile } = useAuth()

  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [form, setForm] = useState<ProductForm>(INITIAL_FORM)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [isAdvancedMode, setIsAdvancedMode] = useState(false)
  const [isColorMode, setIsColorMode] = useState(false)
  const [colorVariants, setColorVariants] = useState<ColorVariantDraft[]>([
    createColorVariant(),
  ])
  const [catalogSearch, setCatalogSearch] = useState('')

  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [savingProduct, setSavingProduct] = useState(false)

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedCategory = getCategoryFromKey(form.categoryKey)

  const availableSubcategories = useMemo(
    () => getSubcategoriesByMainCategory(selectedCategory.main),
    [selectedCategory.main],
  )

  const selectedSizes = useMemo(() => parseSizes(form.sizes), [form.sizes])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = catalogSearch.trim().toLowerCase()

    if (!normalizedSearch) {
      return products
    }

    return products.filter((product) =>
      [
        product.name,
        product.main_category,
        product.sub_category,
        product.slug,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [catalogSearch, products])

  const productStats = useMemo(() => {
    const availableCount = products.filter((product) => !product.is_out_of_stock).length
    const outOfStockCount = products.filter((product) => product.is_out_of_stock).length

    return {
      productCount: products.length,
      availableCount,
      outOfStockCount,
    }
  }, [products])

  const loadProductsData = async () => {
    try {
      setLoadingProducts(true)
      const data = await listProducts()
      setProducts(dedupeProductsBySlug(data))
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de charger les produits.',
      )
    } finally {
      setLoadingProducts(false)
    }
  }

  const loadOrdersData = async () => {
    try {
      setLoadingOrders(true)
      const data = await listOrders()
      setOrders(data)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Impossible de charger les commandes.',
      )
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    void loadProductsData()
    void loadOrdersData()
  }, [])

  const resetForm = () => {
    setForm(INITIAL_FORM)
    setEditingProduct(null)
    setSelectedImage(null)
    setIsAdvancedMode(false)
    setIsColorMode(false)
    setColorVariants([createColorVariant()])
  }

  const handleMainCategoryChange = (mainCategory: string) => {
    const firstSubCategory = getSubcategoriesByMainCategory(mainCategory)[0] ?? 'Robes'

    setForm((current) => ({
      ...current,
      categoryKey: `${mainCategory}|||${firstSubCategory}`,
    }))
  }

  const handleSubCategoryChange = (subCategory: string) => {
    setForm((current) => ({
      ...current,
      categoryKey: `${selectedCategory.main}|||${subCategory}`,
    }))
  }

  const handleToggleSize = (size: string) => {
    setForm((current) => {
      const currentSizes = parseSizes(current.sizes)
      const hasSize = currentSizes.includes(size)
      const nextSizes = hasSize
        ? currentSizes.filter((entry) => entry !== size)
        : [...currentSizes, size]

      return {
        ...current,
        sizes: formatSizes(nextSizes),
      }
    })
  }

  const addColorVariant = () => {
    setColorVariants((current) => [...current, createColorVariant()])
  }

  const removeColorVariant = (id: string) => {
    setColorVariants((current) => {
      const next = current.filter((variant) => variant.id !== id)
      return next.length ? next : [createColorVariant()]
    })
  }

  const updateColorVariant = (
    id: string,
    patch: Partial<ColorVariantDraft>,
  ) => {
    setColorVariants((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, ...patch } : variant,
      ),
    )
  }

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = []
    for (const file of files) {
      const fileUrl = await uploadProductImage(file)
      uploadedUrls.push(fileUrl)
    }
    return uploadedUrls
  }

  const handleSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSavingProduct(true)
      setErrorMessage(null)
      setStatusMessage(null)

      const price = Number(form.price)
      const comparePrice = form.compare_price.trim()
        ? Number(form.compare_price)
        : null
      const sizes = parseSizes(form.sizes)
      const internalStock = form.is_out_of_stock ? 0 : 999

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Prix invalide. Entrez un montant supérieur à 0.')
      }

      if (!sizes.length) {
        throw new Error('Ajoutez au moins une taille.')
      }

      if (
        comparePrice !== null &&
        (!Number.isFinite(comparePrice) || comparePrice < 0)
      ) {
        throw new Error('Prix barré invalide.')
      }

      const category = getCategoryFromKey(form.categoryKey)
      const usedSlugs = new Set(products.map((product) => product.slug))
      if (editingProduct?.slug) {
        usedSlugs.delete(editingProduct.slug)
      }

      if (isColorMode && !editingProduct) {
        const preparedVariants = colorVariants
          .map((variant) => ({
            ...variant,
            color: variant.color.trim(),
            parsedUrls: parseGalleryUrls(variant.image_urls),
          }))
          .filter(
            (variant) =>
              variant.color || variant.parsedUrls.length > 0 || variant.files.length > 0,
          )

        if (!preparedVariants.length) {
          throw new Error('Ajoutez au moins une couleur avec des photos.')
        }

        const baseName = form.name.trim()
        const baseSlug = toSlug(form.slug.trim() || form.name)
        if (!baseSlug) {
          throw new Error('Nom du produit invalide.')
        }

        let createdCount = 0

        for (const variant of preparedVariants) {
          if (!variant.color) {
            throw new Error('Chaque variante doit avoir un nom de couleur.')
          }

          const uploadedFiles = await uploadFiles(variant.files)
          const images = Array.from(
            new Set([...variant.parsedUrls, ...uploadedFiles]),
          )

          if (!images.length) {
            throw new Error(`Ajoutez au moins une photo pour ${variant.color}.`)
          }

          const colorSlug = toSlug(variant.color)
          const variantSlug = buildUniqueSlug(
            `${baseSlug}-${colorSlug || 'couleur'}`,
            usedSlugs,
          )

          const variantPayload: ProductPayload = {
            name: `${baseName} - ${variant.color}`,
            slug: variantSlug,
            description:
              form.description.trim() ||
              `Article premium HOTGYAAL. Couleur: ${variant.color}.`,
            price,
            compare_price: comparePrice,
            stock: internalStock,
            main_category: category.main,
            sub_category: category.sub,
            image_url: images[0],
            gallery_urls: images.slice(1),
            sizes,
            is_out_of_stock: form.is_out_of_stock,
            is_new: form.is_new,
            is_best_seller: form.is_best_seller,
          }

          await upsertProduct(variantPayload)
          createdCount += 1
        }

        setStatusMessage(
          `${createdCount} variante(s) couleur ajoutée(s) avec succès.`,
        )
        resetForm()
        await loadProductsData()
        return
      }

      let imageUrl = form.image_url.trim() || null

      if (selectedImage) {
        imageUrl = await uploadProductImage(selectedImage)
      }

      if (!imageUrl && editingProduct?.image_url) {
        imageUrl = editingProduct.image_url
      }

      const generatedSlug = toSlug(form.slug.trim() || form.name)
      if (!generatedSlug) {
        throw new Error('Nom du produit invalide.')
      }

      const finalSlug = buildUniqueSlug(generatedSlug, usedSlugs)

      const payload: ProductPayload = {
        name: form.name.trim(),
        slug: finalSlug,
        description: form.description.trim() || 'Article premium HOTGYAAL.',
        price,
        compare_price: comparePrice,
        stock: internalStock,
        main_category: category.main,
        sub_category: category.sub,
        image_url: imageUrl,
        gallery_urls: parseGalleryUrls(form.gallery_urls),
        sizes,
        is_out_of_stock: form.is_out_of_stock,
        is_new: form.is_new,
        is_best_seller: form.is_best_seller,
      }

      await upsertProduct(payload, editingProduct?.id)
      setStatusMessage(
        editingProduct
          ? 'Produit mis à jour avec succès.'
          : 'Produit ajouté avec succès.',
      )
      resetForm()
      await loadProductsData()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Impossible d\'enregistrer le produit.',
      )
    } finally {
      setSavingProduct(false)
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setSelectedImage(null)
    setIsAdvancedMode(true)
    setIsColorMode(false)
    setColorVariants([createColorVariant()])
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: String(product.price),
      compare_price: product.compare_price ? String(product.compare_price) : '',
      sizes: formatSizes(product.sizes.length ? product.sizes : DEFAULT_SIZES),
      categoryKey: getCategoryKeyFromProduct(product),
      image_url: product.image_url ?? '',
      gallery_urls: (product.gallery_urls ?? []).join(', '),
      is_out_of_stock: product.is_out_of_stock,
      is_new: product.is_new,
      is_best_seller: product.is_best_seller,
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteProduct = async (product: Product) => {
    const shouldDelete = window.confirm(`Supprimer ${product.name} ?`)

    if (!shouldDelete) {
      return
    }

    try {
      setErrorMessage(null)
      setStatusMessage(null)
      await removeProduct(product.id)
      setStatusMessage('Produit supprimé.')
      await loadProductsData()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Suppression impossible.',
      )
    }
  }

  const handleToggleOutOfStock = async (product: Product) => {
    try {
      setErrorMessage(null)
      setStatusMessage(null)

      const sizes = product.sizes.length ? product.sizes : DEFAULT_SIZES
      const nextOutOfStock = !product.is_out_of_stock

      const payload: ProductPayload = {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compare_price: product.compare_price,
        stock: nextOutOfStock ? 0 : Math.max(product.stock, 1),
        main_category: product.main_category,
        sub_category: product.sub_category,
        image_url: product.image_url,
        gallery_urls: product.gallery_urls,
        sizes,
        is_out_of_stock: nextOutOfStock,
        is_new: product.is_new,
        is_best_seller: product.is_best_seller,
      }

      await upsertProduct(payload, product.id)
      setStatusMessage(
        nextOutOfStock
          ? 'Produit passe en rupture.'
          : 'Produit remis en vente.',
      )
      await loadProductsData()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Mise a jour impossible.',
      )
    }
  }

  const handleOrderStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      setErrorMessage(null)
      await updateOrderStatus(orderId, status)
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, status } : order,
        ),
      )
      setStatusMessage('Statut de commande mis à jour.')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Mise à jour impossible.',
      )
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="section admin-section">
        <div className="container">
          <article className="admin-card">
            <h1>HOTGYAAL Back Office</h1>
            <p className="error-text">
              Supabase n&apos;est pas configuré. Ajoutez
              {' '}NEXT_PUBLIC_SUPABASE_URL et
              {' '}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
            </p>
          </article>
        </div>
      </section>
    )
  }

  return (
    <section className="section admin-section">
      <div className="container">
        <div className="admin-header">
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1>HOTGYAAL Back Office</h1>
            <p>
              {profile?.full_name
                ? `Connecté en tant que ${profile.full_name}`
                : 'Session admin active'}
            </p>
          </div>

          <button type="button" className="button button--ghost" onClick={signOut}>
            Déconnexion
          </button>
        </div>

        <div className="admin-kpi-grid">
          <article className="admin-kpi-card">
            <p>Produits</p>
            <strong>{productStats.productCount}</strong>
          </article>
          <article className="admin-kpi-card">
            <p>Disponibles</p>
            <strong>{productStats.availableCount}</strong>
          </article>
          <article className="admin-kpi-card">
            <p>Rupture</p>
            <strong>{productStats.outOfStockCount}</strong>
          </article>
        </div>

        <div className="admin-tabs">
          <button
            type="button"
            className={activeTab === 'products' ? 'chip chip--active' : 'chip'}
            onClick={() => setActiveTab('products')}
          >
            Produits
          </button>
          <button
            type="button"
            className={activeTab === 'orders' ? 'chip chip--active' : 'chip'}
            onClick={() => setActiveTab('orders')}
          >
            Commandes
          </button>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {statusMessage ? <p className="success-text">{statusMessage}</p> : null}

        {activeTab === 'products' ? (
          <>
            <article className="admin-card">
              <div className="admin-toolbar">
                <div>
                  <h2>{editingProduct ? 'Modifier un produit' : 'Ajouter un produit'}</h2>
                  <p className="admin-help">
                    Mode simple pour aller vite. Activez le mode avancé pour tout
                    modifier.
                  </p>
                </div>
                <div className="admin-toggle-row">
                  <label className="inline-toggle">
                    <input
                      type="checkbox"
                      checked={isAdvancedMode}
                      onChange={(event) => setIsAdvancedMode(event.target.checked)}
                    />
                    Mode avancé
                  </label>

                  {!editingProduct ? (
                    <label className="inline-toggle">
                      <input
                        type="checkbox"
                        checked={isColorMode}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setIsColorMode(checked)
                          if (checked) {
                            setSelectedImage(null)
                          }
                        }}
                      />
                      Article multi-couleurs
                    </label>
                  ) : null}
                </div>
              </div>

              <form onSubmit={handleSaveProduct} className="admin-form">
                <label className="full-width">
                  Nom du produit
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, name: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Prix (XOF)
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.price}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, price: event.target.value }))
                    }
                  />
                </label>

                <label className="full-width">
                  Tailles (separees par virgules)
                  <input
                    required
                    placeholder="Ex: S, M, L, XL"
                    value={form.sizes}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, sizes: event.target.value }))
                    }
                  />
                </label>

                <div className="full-width admin-size-options">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      type="button"
                      key={size}
                      className={
                        selectedSizes.includes(size) ? 'chip chip--active' : 'chip'
                      }
                      onClick={() => handleToggleSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                {!isAdvancedMode ? (
                  <label className="full-width">
                    Catégorie
                    <select
                      value={form.categoryKey}
                      onChange={(event) =>
                        setForm((state) => ({ ...state, categoryKey: event.target.value }))
                      }
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <label>
                      Catégorie principale
                      <select
                        value={selectedCategory.main}
                        onChange={(event) => handleMainCategoryChange(event.target.value)}
                      >
                        {MAIN_CATEGORY_NAMES.map((mainCategory) => (
                          <option key={mainCategory} value={mainCategory}>
                            {mainCategory}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Sous-catégorie
                      <select
                        value={selectedCategory.sub}
                        onChange={(event) => handleSubCategoryChange(event.target.value)}
                      >
                        {availableSubcategories.map((subCategory) => (
                          <option key={subCategory} value={subCategory}>
                            {subCategory}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {!isColorMode ? (
                  <>
                    <label className="full-width">
                      Photo produit (fichier)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setSelectedImage(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>

                    <label className="full-width">
                      URL photo (optionnel)
                      <input
                        type="url"
                        placeholder="https://..."
                        value={form.image_url}
                        onChange={(event) =>
                          setForm((state) => ({ ...state, image_url: event.target.value }))
                        }
                      />
                    </label>
                  </>
                ) : (
                  <div className="full-width admin-variant-list">
                    {colorVariants.map((variant, index) => (
                      <article className="admin-variant-card" key={variant.id}>
                        <div className="admin-variant-head">
                          <h3>Couleur {index + 1}</h3>
                          {colorVariants.length > 1 ? (
                            <button
                              type="button"
                              className="button button--ghost"
                              onClick={() => removeColorVariant(variant.id)}
                            >
                              Retirer
                            </button>
                          ) : null}
                        </div>

                        <label>
                          Nom couleur
                          <input
                            placeholder="Ex: Rouge"
                            value={variant.color}
                            onChange={(event) =>
                              updateColorVariant(variant.id, { color: event.target.value })
                            }
                          />
                        </label>

                        <label>
                          Photos couleur (fichiers)
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) =>
                              updateColorVariant(variant.id, {
                                files: Array.from(event.target.files ?? []),
                              })
                            }
                          />
                        </label>

                        <label>
                          URLs photos (optionnel)
                          <input
                            placeholder="https://... , https://..."
                            value={variant.image_urls}
                            onChange={(event) =>
                              updateColorVariant(variant.id, {
                                image_urls: event.target.value,
                              })
                            }
                          />
                        </label>
                      </article>
                    ))}

                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={addColorVariant}
                    >
                      Ajouter une couleur
                    </button>
                  </div>
                )}

                <label className="full-width">
                  Description
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>

                {isAdvancedMode ? (
                  <>
                    <label>
                      Slug (optionnel)
                      <input
                        placeholder="auto-généré depuis le nom"
                        value={form.slug}
                        onChange={(event) =>
                          setForm((state) => ({ ...state, slug: event.target.value }))
                        }
                      />
                    </label>

                    <label>
                      Prix barré (optionnel)
                      <input
                        type="number"
                        min="0"
                        value={form.compare_price}
                        onChange={(event) =>
                          setForm((state) => ({
                            ...state,
                            compare_price: event.target.value,
                          }))
                        }
                      />
                    </label>

                    {!isColorMode ? (
                      <label className="full-width">
                        Galerie (URLs séparées par virgules)
                        <input
                          placeholder="https://... , https://..."
                          value={form.gallery_urls}
                          onChange={(event) =>
                            setForm((state) => ({
                              ...state,
                              gallery_urls: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.is_out_of_stock}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        is_out_of_stock: event.target.checked,
                      }))
                    }
                  />
                  Rupture de stock
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.is_new}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, is_new: event.target.checked }))
                    }
                  />
                  Nouveau
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.is_best_seller}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        is_best_seller: event.target.checked,
                      }))
                    }
                  />
                  Best seller
                </label>

                <div className="admin-form-actions full-width">
                  <button className="button" type="submit" disabled={savingProduct}>
                    {savingProduct
                      ? 'Enregistrement...'
                      : editingProduct
                        ? 'Mettre à jour'
                        : 'Ajouter le produit'}
                  </button>

                  {editingProduct ? (
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={resetForm}
                    >
                      Annuler
                    </button>
                  ) : null}
                </div>
              </form>
            </article>

            <article className="admin-card">
              <div className="admin-toolbar">
                <h2>Catalogue ({filteredProducts.length})</h2>
                <label className="admin-search">
                  <span>Recherche</span>
                  <input
                    type="search"
                    placeholder="Nom, catégorie ou slug"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                  />
                </label>
              </div>

              {loadingProducts ? <p>Chargement...</p> : null}

              <div className="admin-product-grid">
                {filteredProducts.map((product) => (
                  <article key={product.id} className="admin-product-item">
                    <img
                      src={
                        product.image_url ||
                        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80'
                      }
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                    />
                    <div>
                      <h3>{product.name}</h3>
                      <p>
                        {product.main_category} · {product.sub_category}
                      </p>
                      <p className="admin-product-meta">
                        Tailles: {(product.sizes.length ? product.sizes : DEFAULT_SIZES).join(', ')}
                      </p>
                      <p className="admin-product-meta">Slug: {product.slug}</p>
                      <p className="admin-product-meta">
                        Statut: {product.is_out_of_stock ? 'Rupture' : 'Disponible'}
                      </p>
                      <strong>{formatCurrency(product.price)}</strong>
                    </div>
                    <div className="admin-product-actions">
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => handleEditProduct(product)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="button button--ghost danger"
                        onClick={() => handleToggleOutOfStock(product)}
                      >
                        {product.is_out_of_stock ? 'Remettre en vente' : 'Marquer rupture'}
                      </button>
                      <button
                        type="button"
                        className="button button--ghost danger"
                        onClick={() => handleDeleteProduct(product)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </>
        ) : (
          <article className="admin-card">
            <h2>Commandes clients ({orders.length})</h2>
            {loadingOrders ? <p>Chargement...</p> : null}

            <div className="orders-list">
              {orders.map((order) => (
                <article className="order-card" key={order.id}>
                  <div className="order-card__header">
                    <div>
                      <h3>{order.order_number}</h3>
                      <p>
                        {order.customer_name} · {order.customer_email}
                      </p>
                      <span>{formatDate(order.created_at)}</span>
                    </div>

                    <div>
                      <strong>{formatCurrency(order.total_amount)}</strong>
                      <select
                        value={order.status}
                        onChange={(event) =>
                          handleOrderStatusUpdate(
                            order.id,
                            event.target.value as OrderStatus,
                          )
                        }
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="order-card__items">
                    {(order.order_items ?? []).map((item) => (
                      <div key={item.id}>
                        <p>
                          {item.product_name}
                          {item.selected_size ? ` - ${item.selected_size}` : ''}
                        </p>
                        <span>
                          {item.quantity} x {formatCurrency(item.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <address>
                    {order.shipping_address.line1}
                    {order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ''}
                    , {order.shipping_address.postal_code} {order.shipping_address.city},{' '}
                    {order.shipping_address.country}
                  </address>
                </article>
              ))}
            </div>
          </article>
        )}
      </div>
    </section>
  )
}
