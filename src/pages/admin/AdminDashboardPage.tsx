import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useStoreCategories } from '../../context/StoreCategoriesContext'
import { useStoreSettings } from '../../context/StoreSettingsContext'
import { CATEGORY_TREE } from '../../constants/categories'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  removeCategory,
  upsertCategory,
  uploadCategoryImage,
} from '../../services/categories'
import { listOrders, updateOrderStatus } from '../../services/orders'
import {
  listProducts,
  removeProduct,
  upsertProduct,
  uploadProductImage,
} from '../../services/products'
import type {
  Order,
  OrderStatus,
  Product,
  ProductPayload,
  StoreCategory,
  StoreCategoryPayload,
  StoreSettingsPayload,
} from '../../types'
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

type CatalogStockFilter = 'all' | 'available' | 'out_of_stock'
type BulkProductAction =
  | 'mark_out'
  | 'mark_available'
  | 'set_new'
  | 'unset_new'
  | 'set_best'
  | 'unset_best'
  | 'delete'

type CategoryOption = {
  key: string
  label: string
  main: string
  sub: string
}

const FALLBACK_CATEGORY_OPTIONS: CategoryOption[] = CATEGORY_TREE.flatMap((category) =>
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
const WOMEN_CATEGORY_NAME = 'Vêtements Femmes'
const WOMEN_CATEGORY_SLUG = 'vetements-femmes'

const DEFAULT_CATEGORY_KEY =
  FALLBACK_CATEGORY_OPTIONS.find(
    (option) =>
      option.main === WOMEN_CATEGORY_NAME && option.sub === 'Robes',
  )?.key ?? FALLBACK_CATEGORY_OPTIONS[0]?.key ?? FALLBACK_CATEGORY.key

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
  is_out_of_stock: boolean
  is_new: boolean
  is_best_seller: boolean
}

type CategoryForm = {
  name: string
  slug: string
  description: string
  subcategories: string
  is_active: boolean
  display_order: string
}

type ColorVariantDraft = {
  id: string
  color: string
  files: File[]
}

const INITIAL_FORM: ProductForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  compare_price: '',
  sizes: DEFAULT_SIZES.join(', '),
  categoryKey: '',
  is_out_of_stock: false,
  is_new: true,
  is_best_seller: false,
}

const INITIAL_CATEGORY_FORM: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  subcategories: '',
  is_active: true,
  display_order: '0',
}

const createColorVariant = (): ColorVariantDraft => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  color: '',
  files: [],
})

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

const parseSubcategories = (raw: string): string[] =>
  Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )

const buildCategoryOptions = (categories: StoreCategory[]): CategoryOption[] => {
  const source = categories.length
    ? categories.filter((category) => category.is_active)
    : []

  const options = source.flatMap((category) =>
    category.subcategories.map((subCategory) => ({
      key: `${category.name}|||${subCategory}`,
      label: `${category.name} > ${subCategory}`,
      main: category.name,
      sub: subCategory,
    })),
  )

  return options.length ? options : FALLBACK_CATEGORY_OPTIONS
}

const getCategoryFromKey = (
  categoryKey: string,
  categoryOptions: CategoryOption[],
): CategoryOption =>
  categoryOptions.find((option) => option.key === categoryKey) ??
  categoryOptions[0] ??
  FALLBACK_CATEGORY

const getCategoryKeyFromProduct = (
  product: Product,
  categoryOptions: CategoryOption[],
): string => {
  const option = categoryOptions.find(
    (entry) =>
      entry.main === product.main_category && entry.sub === product.sub_category,
  )

  return option?.key ?? categoryOptions[0]?.key ?? DEFAULT_CATEGORY_KEY
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
  const {
    categories,
    loading: loadingCategories,
    refreshCategories,
  } = useStoreCategories()
  const { settings, saveSettings, loading: loadingSettings } = useStoreSettings()

  const [activeTab, setActiveTab] = useState<
    'site' | 'categories' | 'products' | 'orders'
  >('site')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [form, setForm] = useState<ProductForm>(INITIAL_FORM)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<File[]>([])
  const [isAdvancedMode, setIsAdvancedMode] = useState(false)
  const [isColorMode, setIsColorMode] = useState(false)
  const [colorVariants, setColorVariants] = useState<ColorVariantDraft[]>([
    createColorVariant(),
  ])
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(
    INITIAL_CATEGORY_FORM,
  )
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null)
  const [selectedCategoryImage, setSelectedCategoryImage] = useState<File | null>(
    null,
  )
  const [savingCategory, setSavingCategory] = useState(false)
  const [savingClothingTypes, setSavingClothingTypes] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all')
  const [catalogStockFilter, setCatalogStockFilter] =
    useState<CatalogStockFilter>('all')
  const [showAdvancedTools, setShowAdvancedTools] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [bulkProductsBusy, setBulkProductsBusy] = useState(false)
  const [ordersSearch, setOrdersSearch] = useState('')
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<
    OrderStatus | 'all'
  >('all')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [bulkOrdersBusy, setBulkOrdersBusy] = useState(false)
  const [bulkOrderStatus, setBulkOrderStatus] = useState<OrderStatus>('processing')

  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingSiteSettings, setSavingSiteSettings] = useState(false)

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [siteForm, setSiteForm] = useState<StoreSettingsPayload>(settings)
  const [clothingTypesInput, setClothingTypesInput] = useState('')
  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories),
    [categories],
  )
  const womenCategory = useMemo(
    () =>
      categories.find((category) => category.slug === WOMEN_CATEGORY_SLUG) ??
      categories.find((category) => category.name === WOMEN_CATEGORY_NAME) ??
      null,
    [categories],
  )
  const clothingTypeOptions = useMemo(
    () => womenCategory?.subcategories ?? [],
    [womenCategory],
  )
  const simpleCategoryOptions = useMemo(() => {
    const womenOptions = categoryOptions.filter(
      (option) => option.main === WOMEN_CATEGORY_NAME,
    )
    return womenOptions.length ? womenOptions : categoryOptions
  }, [categoryOptions])
  const isSimpleModeWomenOnly = useMemo(
    () =>
      simpleCategoryOptions.length > 0 &&
      simpleCategoryOptions.every((option) => option.main === WOMEN_CATEGORY_NAME),
    [simpleCategoryOptions],
  )
  const isWomenCategoryForm = useMemo(
    () => toSlug(categoryForm.name.trim()) === WOMEN_CATEGORY_SLUG,
    [categoryForm.name],
  )
  const mainCategoryNames = useMemo(
    () =>
      Array.from(new Set(categoryOptions.map((option) => option.main))),
    [categoryOptions],
  )
  const selectedCategory = useMemo(
    () => getCategoryFromKey(form.categoryKey, categoryOptions),
    [form.categoryKey, categoryOptions],
  )
  const availableSubcategories = useMemo(
    () =>
      categoryOptions
        .filter((option) => option.main === selectedCategory.main)
        .map((option) => option.sub),
    [categoryOptions, selectedCategory.main],
  )

  const selectedSizes = useMemo(() => parseSizes(form.sizes), [form.sizes])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = catalogSearch.trim().toLowerCase()

    return products.filter((product) =>
      {
        const matchesSearch =
          !normalizedSearch ||
          [
            product.name,
            product.main_category,
            product.sub_category,
            product.slug,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)

        const matchesCategory =
          catalogCategoryFilter === 'all' ||
          product.main_category === catalogCategoryFilter

        const matchesStock =
          catalogStockFilter === 'all' ||
          (catalogStockFilter === 'available' && !product.is_out_of_stock) ||
          (catalogStockFilter === 'out_of_stock' && product.is_out_of_stock)

        return matchesSearch && matchesCategory && matchesStock
      },
    )
  }, [catalogCategoryFilter, catalogSearch, catalogStockFilter, products])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = ordersSearch.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          order.order_number,
          order.customer_name,
          order.customer_email,
          order.customer_phone,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

      const matchesStatus =
        ordersStatusFilter === 'all' || order.status === ordersStatusFilter

      return matchesSearch && matchesStatus
    })
  }, [orders, ordersSearch, ordersStatusFilter])

  const productStats = useMemo(() => {
    const availableCount = products.filter((product) => !product.is_out_of_stock).length
    const outOfStockCount = products.filter((product) => product.is_out_of_stock).length

    return {
      productCount: products.length,
      availableCount,
      outOfStockCount,
    }
  }, [products])

  const orderStats = useMemo(() => {
    const pending = orders.filter((order) => order.status === 'pending').length
    const processing = orders.filter((order) => order.status === 'processing').length
    const delivered = orders.filter((order) => order.status === 'delivered').length

    return {
      total: orders.length,
      pending,
      processing,
      delivered,
    }
  }, [orders])

  const areAllFilteredProductsSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedProductIds.has(product.id))

  const areAllFilteredOrdersSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((order) => selectedOrderIds.has(order.id))

  useEffect(() => {
    setSiteForm(settings)
  }, [settings])

  useEffect(() => {
    setClothingTypesInput((womenCategory?.subcategories ?? []).join(', '))
  }, [womenCategory])

  useEffect(() => {
    const source = isAdvancedMode ? categoryOptions : simpleCategoryOptions
    setForm((current) => {
      const hasOption = source.some((option) => option.key === current.categoryKey)
      if (hasOption) {
        return current
      }

      return {
        ...current,
        categoryKey: source[0]?.key ?? DEFAULT_CATEGORY_KEY,
      }
    })
  }, [categoryOptions, isAdvancedMode, simpleCategoryOptions])

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

  useEffect(() => {
    setSelectedProductIds((current) => {
      const allowed = new Set(filteredProducts.map((product) => product.id))
      const next = new Set<string>()
      current.forEach((id) => {
        if (allowed.has(id)) {
          next.add(id)
        }
      })
      return next
    })
  }, [filteredProducts])

  useEffect(() => {
    setSelectedOrderIds((current) => {
      const allowed = new Set(filteredOrders.map((order) => order.id))
      const next = new Set<string>()
      current.forEach((id) => {
        if (allowed.has(id)) {
          next.add(id)
        }
      })
      return next
    })
  }, [filteredOrders])

  useEffect(() => {
    if (
      catalogCategoryFilter !== 'all' &&
      !mainCategoryNames.includes(catalogCategoryFilter)
    ) {
      setCatalogCategoryFilter('all')
    }
  }, [catalogCategoryFilter, mainCategoryNames])

  const resetForm = () => {
    setForm({
      ...INITIAL_FORM,
      categoryKey: categoryOptions[0]?.key ?? DEFAULT_CATEGORY_KEY,
    })
    setEditingProduct(null)
    setSelectedImage(null)
    setSelectedGalleryImages([])
    setIsAdvancedMode(false)
    setIsColorMode(false)
    setColorVariants([createColorVariant()])
  }

  const resetCategoryForm = () => {
    setCategoryForm({
      ...INITIAL_CATEGORY_FORM,
      display_order: String(categories.length),
    })
    setEditingCategory(null)
    setSelectedCategoryImage(null)
  }

  const handleMainCategoryChange = (mainCategory: string) => {
    const firstSubCategory =
      categoryOptions.find((option) => option.main === mainCategory)?.sub ??
      'General'

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

      const category = getCategoryFromKey(form.categoryKey, categoryOptions)
      const usedSlugs = new Set(products.map((product) => product.slug))
      if (editingProduct?.slug) {
        usedSlugs.delete(editingProduct.slug)
      }

      if (isColorMode && !editingProduct) {
        const preparedVariants = colorVariants
          .map((variant) => ({
            ...variant,
            color: variant.color.trim(),
          }))
          .filter(
            (variant) => variant.color || variant.files.length > 0,
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

          if (!variant.files.length) {
            throw new Error(`Ajoutez au moins une photo pour ${variant.color}.`)
          }

          const uploadedFiles = await uploadFiles(variant.files)
          const images = Array.from(new Set(uploadedFiles))

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

      let imageUrl = editingProduct?.image_url ?? null
      if (selectedImage) {
        imageUrl = await uploadProductImage(selectedImage)
      } else if (!editingProduct) {
        throw new Error('Ajoutez une photo principale du produit.')
      }

      const uploadedGallery =
        selectedGalleryImages.length > 0
          ? await uploadFiles(selectedGalleryImages)
          : null

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
        gallery_urls: uploadedGallery ?? (editingProduct?.gallery_urls ?? []),
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
    setSelectedGalleryImages([])
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
      categoryKey: getCategoryKeyFromProduct(product, categoryOptions),
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

  const buildPayloadFromProduct = (
    product: Product,
    patch: Partial<ProductPayload> = {},
  ): ProductPayload => {
    const sizes = product.sizes.length ? product.sizes : DEFAULT_SIZES
    return {
      name: patch.name ?? product.name,
      slug: patch.slug ?? product.slug,
      description: patch.description ?? product.description,
      price: patch.price ?? product.price,
      compare_price:
        patch.compare_price === undefined
          ? product.compare_price
          : patch.compare_price,
      stock: patch.stock ?? product.stock,
      main_category: patch.main_category ?? product.main_category,
      sub_category: patch.sub_category ?? product.sub_category,
      image_url: patch.image_url === undefined ? product.image_url : patch.image_url,
      gallery_urls: patch.gallery_urls ?? product.gallery_urls,
      sizes: patch.sizes ?? sizes,
      is_out_of_stock:
        patch.is_out_of_stock === undefined
          ? product.is_out_of_stock
          : patch.is_out_of_stock,
      is_new: patch.is_new === undefined ? product.is_new : patch.is_new,
      is_best_seller:
        patch.is_best_seller === undefined
          ? product.is_best_seller
          : patch.is_best_seller,
    }
  }

  const buildCategoryPayloadFromCategory = (
    category: StoreCategory,
    patch: Partial<StoreCategoryPayload> = {},
  ): StoreCategoryPayload => ({
    slug: patch.slug ?? category.slug,
    name: patch.name ?? category.name,
    description: patch.description ?? category.description,
    image_url:
      patch.image_url === undefined ? category.image_url : patch.image_url,
    subcategories: patch.subcategories ?? category.subcategories,
    is_active:
      patch.is_active === undefined ? category.is_active : patch.is_active,
    display_order:
      patch.display_order === undefined
        ? category.display_order
        : patch.display_order,
  })

  const handleSaveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSavingCategory(true)
      setErrorMessage(null)
      setStatusMessage(null)

      const name = categoryForm.name.trim()
      const description =
        categoryForm.description.trim() || 'Categorie HOTGYAAL'
      const subcategories = parseSubcategories(categoryForm.subcategories)
      const displayOrder = Number(categoryForm.display_order)

      if (!name) {
        throw new Error('Nom de categorie requis.')
      }

      if (!subcategories.length) {
        throw new Error('Ajoutez au moins une sous-categorie.')
      }

      if (!Number.isFinite(displayOrder) || displayOrder < 0) {
        throw new Error('Ordre d affichage invalide.')
      }

      const usedSlugs = new Set(categories.map((category) => category.slug))
      if (editingCategory?.slug) {
        usedSlugs.delete(editingCategory.slug)
      }

      const generatedSlug = toSlug(categoryForm.slug.trim() || name)
      if (!generatedSlug) {
        throw new Error('Slug categorie invalide.')
      }
      const finalSlug = buildUniqueSlug(generatedSlug, usedSlugs)

      let imageUrl = editingCategory?.image_url ?? null
      if (selectedCategoryImage) {
        imageUrl = await uploadCategoryImage(selectedCategoryImage)
      } else if (!editingCategory) {
        throw new Error('Ajoutez une image pour la categorie.')
      }

      const payload: StoreCategoryPayload = {
        slug: finalSlug,
        name,
        description,
        image_url: imageUrl,
        subcategories,
        is_active: categoryForm.is_active,
        display_order: Math.trunc(displayOrder),
      }

      await upsertCategory(payload, editingCategory?.id)

      if (editingCategory && editingCategory.name !== name) {
        const impactedProducts = products.filter(
          (product) => product.main_category === editingCategory.name,
        )
        for (const product of impactedProducts) {
          const nextSubCategory = subcategories.includes(product.sub_category)
            ? product.sub_category
            : subcategories[0]
          await upsertProduct(
            buildPayloadFromProduct(product, {
              main_category: name,
              sub_category: nextSubCategory,
            }),
            product.id,
          )
        }
      }

      await refreshCategories()
      await loadProductsData()
      setStatusMessage(
        editingCategory
          ? 'Categorie mise a jour avec succes.'
          : 'Categorie ajoutee avec succes.',
      )
      resetCategoryForm()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de sauvegarder la categorie.',
      )
    } finally {
      setSavingCategory(false)
    }
  }

  const handleSaveClothingTypes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSavingClothingTypes(true)
      setErrorMessage(null)
      setStatusMessage(null)

      const subcategories = parseSubcategories(clothingTypesInput)
      if (!subcategories.length) {
        throw new Error('Ajoutez au moins un type de vetement.')
      }

      if (womenCategory) {
        await upsertCategory(
          buildCategoryPayloadFromCategory(womenCategory, {
            subcategories,
          }),
          womenCategory.id,
        )

        const impactedProducts = products.filter(
          (product) =>
            product.main_category === womenCategory.name &&
            !subcategories.includes(product.sub_category),
        )

        for (const product of impactedProducts) {
          await upsertProduct(
            buildPayloadFromProduct(product, {
              sub_category: subcategories[0],
            }),
            product.id,
          )
        }
      } else {
        const usedSlugs = new Set(categories.map((category) => category.slug))
        const payload: StoreCategoryPayload = {
          slug: buildUniqueSlug(WOMEN_CATEGORY_SLUG, usedSlugs),
          name: WOMEN_CATEGORY_NAME,
          description: 'Selection mode femme HOTGYAAL.',
          image_url: null,
          subcategories,
          is_active: true,
          display_order: 0,
        }
        await upsertCategory(payload)
      }

      await refreshCategories()
      await loadProductsData()
      setStatusMessage('Types de vetements enregistres.')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de sauvegarder les types de vetements.',
      )
    } finally {
      setSavingClothingTypes(false)
    }
  }

  const handleEditCategory = (category: StoreCategory) => {
    setEditingCategory(category)
    setSelectedCategoryImage(null)
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      subcategories: category.subcategories.join(', '),
      is_active: category.is_active,
      display_order: String(category.display_order),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteCategory = async (category: StoreCategory) => {
    const usedByProducts = products.some(
      (product) => product.main_category === category.name,
    )
    if (usedByProducts) {
      setErrorMessage(
        'Cette categorie est utilisee par des produits. Passez-la en inactive ou reclasser les produits avant suppression.',
      )
      return
    }

    const shouldDelete = window.confirm(`Supprimer la categorie ${category.name} ?`)
    if (!shouldDelete) {
      return
    }

    try {
      setErrorMessage(null)
      setStatusMessage(null)
      await removeCategory(category.id)
      await refreshCategories()
      setStatusMessage('Categorie supprimee.')
      if (editingCategory?.id === category.id) {
        resetCategoryForm()
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Suppression categorie impossible.',
      )
    }
  }

  const handleToggleCategoryActive = async (category: StoreCategory) => {
    try {
      setErrorMessage(null)
      setStatusMessage(null)
      await upsertCategory(
        buildCategoryPayloadFromCategory(category, {
          is_active: !category.is_active,
        }),
        category.id,
      )
      await refreshCategories()
      setStatusMessage(
        category.is_active
          ? 'Categorie desactivee.'
          : 'Categorie reactivee.',
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Mise a jour categorie impossible.',
      )
    }
  }

  const handleToggleOutOfStock = async (product: Product) => {
    try {
      setErrorMessage(null)
      setStatusMessage(null)

      const nextOutOfStock = !product.is_out_of_stock
      const payload = buildPayloadFromProduct(product, {
        stock: nextOutOfStock ? 0 : Math.max(product.stock, 1),
        is_out_of_stock: nextOutOfStock,
      })
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

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const toggleAllFilteredProducts = () => {
    setSelectedProductIds((current) => {
      if (areAllFilteredProductsSelected) {
        return new Set()
      }

      const next = new Set(current)
      filteredProducts.forEach((product) => next.add(product.id))
      return next
    })
  }

  const handleBulkProductAction = async (action: BulkProductAction) => {
    const targets = products.filter((product) => selectedProductIds.has(product.id))

    if (!targets.length) {
      setErrorMessage('Sélectionnez au moins un produit.')
      return
    }

    if (action === 'delete') {
      const shouldDelete = window.confirm(
        `Supprimer définitivement ${targets.length} produit(s) ?`,
      )
      if (!shouldDelete) {
        return
      }
    }

    try {
      setBulkProductsBusy(true)
      setErrorMessage(null)
      setStatusMessage(null)

      if (action === 'delete') {
        for (const product of targets) {
          await removeProduct(product.id)
        }
      } else {
        for (const product of targets) {
          if (action === 'mark_out') {
            await upsertProduct(
              buildPayloadFromProduct(product, {
                is_out_of_stock: true,
                stock: 0,
              }),
              product.id,
            )
            continue
          }

          if (action === 'mark_available') {
            await upsertProduct(
              buildPayloadFromProduct(product, {
                is_out_of_stock: false,
                stock: Math.max(product.stock, 1),
              }),
              product.id,
            )
            continue
          }

          if (action === 'set_new') {
            await upsertProduct(
              buildPayloadFromProduct(product, { is_new: true }),
              product.id,
            )
            continue
          }

          if (action === 'unset_new') {
            await upsertProduct(
              buildPayloadFromProduct(product, { is_new: false }),
              product.id,
            )
            continue
          }

          if (action === 'set_best') {
            await upsertProduct(
              buildPayloadFromProduct(product, { is_best_seller: true }),
              product.id,
            )
            continue
          }

          if (action === 'unset_best') {
            await upsertProduct(
              buildPayloadFromProduct(product, { is_best_seller: false }),
              product.id,
            )
          }
        }
      }

      setSelectedProductIds(new Set())
      await loadProductsData()

      const labels: Record<BulkProductAction, string> = {
        mark_out: 'marqué(s) en rupture',
        mark_available: 'remis en vente',
        set_new: 'marqué(s) comme nouveaux',
        unset_new: 'retiré(s) des nouveautés',
        set_best: 'marqué(s) best seller',
        unset_best: 'retiré(s) des best sellers',
        delete: 'supprimé(s)',
      }
      setStatusMessage(`${targets.length} produit(s) ${labels[action]}.`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Action groupée impossible.',
      )
    } finally {
      setBulkProductsBusy(false)
    }
  }

  const handleDuplicateProduct = async (product: Product) => {
    try {
      setErrorMessage(null)
      setStatusMessage(null)

      const usedSlugs = new Set(products.map((entry) => entry.slug))
      const baseSlug = toSlug(`${product.slug}-copie`) || `copie-${Date.now()}`
      const duplicateSlug = buildUniqueSlug(baseSlug, usedSlugs)

      const payload = buildPayloadFromProduct(product, {
        name: `${product.name} (Copie)`,
        slug: duplicateSlug,
        is_new: true,
      })

      await upsertProduct(payload)
      setStatusMessage('Produit dupliqué avec succès.')
      await loadProductsData()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Duplication impossible.',
      )
    }
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const toggleAllFilteredOrders = () => {
    setSelectedOrderIds((current) => {
      if (areAllFilteredOrdersSelected) {
        return new Set()
      }

      const next = new Set(current)
      filteredOrders.forEach((order) => next.add(order.id))
      return next
    })
  }

  const handleBulkOrderStatusUpdate = async () => {
    const targets = orders.filter((order) => selectedOrderIds.has(order.id))

    if (!targets.length) {
      setErrorMessage('Sélectionnez au moins une commande.')
      return
    }

    try {
      setBulkOrdersBusy(true)
      setErrorMessage(null)
      setStatusMessage(null)

      for (const order of targets) {
        await updateOrderStatus(order.id, bulkOrderStatus)
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          selectedOrderIds.has(order.id)
            ? { ...order, status: bulkOrderStatus }
            : order,
        ),
      )
      setSelectedOrderIds(new Set())
      setStatusMessage(
        `${targets.length} commande(s) passées en ${bulkOrderStatus}.`,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Mise à jour groupée impossible.',
      )
    } finally {
      setBulkOrdersBusy(false)
    }
  }

  const handleSaveSiteSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSavingSiteSettings(true)
      setErrorMessage(null)
      setStatusMessage(null)
      await saveSettings(siteForm)
      setStatusMessage('Pages du site mises a jour avec succes.')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de sauvegarder les pages du site.',
      )
    } finally {
      setSavingSiteSettings(false)
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
          <article className="admin-kpi-card">
            <p>Commandes</p>
            <strong>{orderStats.total}</strong>
          </article>
          <article className="admin-kpi-card">
            <p>A traiter</p>
            <strong>{orderStats.pending}</strong>
          </article>
          <article className="admin-kpi-card">
            <p>Livrées</p>
            <strong>{orderStats.delivered}</strong>
          </article>
        </div>

        <div className="admin-tabs">
          <button
            type="button"
            className={activeTab === 'site' ? 'chip chip--active' : 'chip'}
            onClick={() => setActiveTab('site')}
          >
            Pages du site
          </button>
          <button
            type="button"
            className={activeTab === 'categories' ? 'chip chip--active' : 'chip'}
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </button>
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
        {loadingSettings ? (
          <p className="admin-help">Chargement des réglages du site...</p>
        ) : null}
        {loadingCategories ? (
          <p className="admin-help">Chargement des categories...</p>
        ) : null}

        {activeTab === 'site' ? (
          <>
            <article className="admin-card">
              <h2>Etapes simples</h2>
              <p className="admin-help">
                Utilisez cet ordre: 1) Pages du site, 2) Categories, 3) Produits,
                4) Commandes.
              </p>
              <div className="admin-step-grid">
                <article className="admin-step-card">
                  <span>1</span>
                  <h3>Accueil</h3>
                  <p>Modifiez le texte principal affiché sur la page d&apos;accueil.</p>
                </article>
                <article className="admin-step-card">
                  <span>2</span>
                  <h3>Contact</h3>
                  <p>Mettez à jour téléphone, email et horaires.</p>
                </article>
                <article className="admin-step-card">
                  <span>3</span>
                  <h3>Catalogue</h3>
                  <p>Gérez les categories, sous-categories et images.</p>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setActiveTab('categories')}
                  >
                    Ouvrir Categories
                  </button>
                </article>
                <article className="admin-step-card">
                  <span>4</span>
                  <h3>Produits</h3>
                  <p>Ajoutez les photos, tailles, prix et couleurs.</p>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setActiveTab('products')}
                  >
                    Ajouter un produit
                  </button>
                </article>
                <article className="admin-step-card">
                  <span>5</span>
                  <h3>Commandes</h3>
                  <p>Mettez à jour le statut des commandes clientes.</p>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setActiveTab('orders')}
                  >
                    Ouvrir Commandes
                  </button>
                </article>
              </div>
            </article>

            <article className="admin-card">
              <h2>Réglages pages du site</h2>
              <p className="admin-help">
                Ce formulaire contrôle Accueil, Contact, Footer et le numéro de
                finalisation des commandes.
              </p>
              <form className="admin-form admin-site-form" onSubmit={handleSaveSiteSettings}>
                <label className="full-width">
                  Bandeau haut du site
                  <input
                    required
                    value={siteForm.announcement_text}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        announcement_text: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Accueil - petit titre
                  <input
                    required
                    value={siteForm.hero_eyebrow}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        hero_eyebrow: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Accueil - grand titre
                  <input
                    required
                    value={siteForm.hero_title}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        hero_title: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="full-width">
                  Accueil - texte
                  <textarea
                    rows={3}
                    required
                    value={siteForm.hero_description}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        hero_description: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="full-width">
                  Contact - texte intro
                  <textarea
                    rows={2}
                    required
                    value={siteForm.contact_intro}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        contact_intro: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Contact - téléphone
                  <input
                    required
                    value={siteForm.contact_phone}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        contact_phone: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Contact - email
                  <input
                    type="email"
                    required
                    value={siteForm.contact_email}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        contact_email: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="full-width">
                  Contact - horaires
                  <input
                    required
                    value={siteForm.contact_hours}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        contact_hours: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="full-width">
                  Footer - texte présentation
                  <textarea
                    rows={2}
                    required
                    value={siteForm.footer_blurb}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        footer_blurb: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Numéro commandes (WhatsApp)
                  <input
                    required
                    placeholder="Ex: 774931474"
                    value={siteForm.order_chat_number}
                    onChange={(event) =>
                      setSiteForm((state) => ({
                        ...state,
                        order_chat_number: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="admin-form-actions full-width">
                  <button type="submit" className="button" disabled={savingSiteSettings}>
                    {savingSiteSettings ? 'Enregistrement...' : 'Sauvegarder les pages'}
                  </button>
                </div>
              </form>
            </article>
          </>
        ) : activeTab === 'categories' ? (
          <>
            <article className="admin-card admin-types-card">
              <div className="admin-toolbar">
                <div>
                  <h2>Types de vetements</h2>
                  <p className="admin-help">
                    Cette zone gere uniquement Vêtements Femmes (Robes, Tops, etc.).
                  </p>
                </div>
              </div>

              <form className="admin-form admin-form--single" onSubmit={handleSaveClothingTypes}>
                <label className="full-width">
                  Liste des types (separes par virgules)
                  <textarea
                    rows={3}
                    required
                    placeholder="Ex: Robes, Tops, T-shirts, Pantalons"
                    value={clothingTypesInput}
                    onChange={(event) => setClothingTypesInput(event.target.value)}
                  />
                </label>
                {clothingTypeOptions.length ? (
                  <p className="admin-help full-width">
                    Actuels: {clothingTypeOptions.join(', ')}
                  </p>
                ) : null}
                <div className="admin-form-actions full-width">
                  <button
                    type="submit"
                    className="button"
                    disabled={savingClothingTypes}
                  >
                    {savingClothingTypes
                      ? 'Enregistrement...'
                      : 'Sauvegarder les types de vetements'}
                  </button>
                </div>
              </form>
            </article>

            <article className="admin-card">
              <div className="admin-toolbar">
                <div>
                  <h2>
                    {editingCategory ? 'Modifier une categorie' : 'Ajouter une categorie'}
                  </h2>
                  <p className="admin-help">
                    Tout se fait par upload d image. Pas de lien URL.
                  </p>
                </div>
                <div className="admin-toolbar-actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => void refreshCategories()}
                    disabled={loadingCategories}
                  >
                    Rafraichir
                  </button>
                </div>
              </div>

              <form className="admin-form" onSubmit={handleSaveCategory}>
                <label>
                  Nom categorie
                  <input
                    required
                    value={categoryForm.name}
                    onChange={(event) =>
                      setCategoryForm((state) => ({
                        ...state,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Slug (optionnel)
                  <input
                    placeholder="auto depuis le nom"
                    value={categoryForm.slug}
                    onChange={(event) =>
                      setCategoryForm((state) => ({
                        ...state,
                        slug: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="full-width">
                  Description categorie
                  <textarea
                    rows={2}
                    required
                    value={categoryForm.description}
                    onChange={(event) =>
                      setCategoryForm((state) => ({
                        ...state,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="full-width">
                  {isWomenCategoryForm
                    ? 'Types de vetements (separes par virgules)'
                    : 'Sous-categories (separees par virgules)'}
                  <input
                    required
                    placeholder={
                      isWomenCategoryForm
                        ? 'Ex: Robes, Tops, T-shirts'
                        : 'Ex: Colliers, Bracelets, Montres'
                    }
                    value={categoryForm.subcategories}
                    onChange={(event) =>
                      setCategoryForm((state) => ({
                        ...state,
                        subcategories: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Ordre affichage
                  <input
                    type="number"
                    min="0"
                    value={categoryForm.display_order}
                    onChange={(event) =>
                      setCategoryForm((state) => ({
                        ...state,
                        display_order: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Image categorie
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setSelectedCategoryImage(event.target.files?.[0] ?? null)
                    }
                  />
                </label>

                {editingCategory?.image_url ? (
                  <p className="admin-help full-width">
                    Image actuelle conservee si aucun nouveau fichier n est choisi.
                  </p>
                ) : null}

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={categoryForm.is_active}
                    onChange={(event) =>
                      setCategoryForm((state) => ({
                        ...state,
                        is_active: event.target.checked,
                      }))
                    }
                  />
                  Categorie active
                </label>

                <div className="admin-form-actions full-width">
                  <button type="submit" className="button" disabled={savingCategory}>
                    {savingCategory
                      ? 'Enregistrement...'
                      : editingCategory
                        ? 'Mettre a jour categorie'
                        : 'Ajouter categorie'}
                  </button>
                  {editingCategory ? (
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={resetCategoryForm}
                    >
                      Annuler
                    </button>
                  ) : null}
                </div>
              </form>
            </article>

            <article className="admin-card">
              <h2>Liste des categories ({categories.length})</h2>
              <div className="admin-product-grid">
                {categories.map((category) => (
                  <article key={category.id} className="admin-product-item">
                    <img
                      src={
                        category.image_url ||
                        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80'
                      }
                      alt={category.name}
                      loading="lazy"
                      decoding="async"
                    />
                    <div>
                      <h3>{category.name}</h3>
                      <p className="admin-product-meta">{category.description}</p>
                      <p className="admin-product-meta">
                        {category.name === WOMEN_CATEGORY_NAME
                          ? 'Types de vetements'
                          : 'Sous-categories'}
                        : {category.subcategories.join(', ')}
                      </p>
                      <p className="admin-product-meta">Slug: {category.slug}</p>
                      <p className="admin-product-meta">
                        Statut: {category.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <div className="admin-product-actions">
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => handleEditCategory(category)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => void handleToggleCategoryActive(category)}
                      >
                        {category.is_active ? 'Desactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        className="button button--ghost danger"
                        onClick={() => void handleDeleteCategory(category)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </>
        ) : activeTab === 'products' ? (
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
                    Type de vetement
                    <select
                      value={form.categoryKey}
                      onChange={(event) =>
                        setForm((state) => ({ ...state, categoryKey: event.target.value }))
                      }
                    >
                      {simpleCategoryOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {isSimpleModeWomenOnly ? option.sub : option.label}
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
                        {mainCategoryNames.map((mainCategory) => (
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
                      Photo principale (obligatoire pour un nouveau produit)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setSelectedImage(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>

                    <label className="full-width">
                      Photos supplementaires
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          setSelectedGalleryImages(Array.from(event.target.files ?? []))
                        }
                      />
                    </label>
                    {editingProduct ? (
                      <p className="admin-help full-width">
                        Galerie actuelle: {editingProduct.gallery_urls.length} photo(s).
                        Ajoutez de nouveaux fichiers pour remplacer cette galerie.
                      </p>
                    ) : null}
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
                <div className="admin-toolbar-actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => void loadProductsData()}
                    disabled={loadingProducts}
                  >
                    Rafraîchir
                  </button>
                  <label className="inline-toggle">
                    <input
                      type="checkbox"
                      checked={showAdvancedTools}
                      onChange={(event) => setShowAdvancedTools(event.target.checked)}
                    />
                    Outils avancés
                  </label>
                </div>
              </div>

              <div className="admin-catalog-filters">
                <label className="admin-search">
                  <span>Recherche</span>
                  <input
                    type="search"
                    placeholder="Nom, catégorie ou slug"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                  />
                </label>

                <label className="admin-search">
                  <span>Catégorie principale</span>
                  <select
                    value={catalogCategoryFilter}
                    onChange={(event) => setCatalogCategoryFilter(event.target.value)}
                  >
                    <option value="all">Toutes</option>
                    {mainCategoryNames.map((mainCategory) => (
                      <option key={mainCategory} value={mainCategory}>
                        {mainCategory}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-search">
                  <span>Disponibilité</span>
                  <select
                    value={catalogStockFilter}
                    onChange={(event) =>
                      setCatalogStockFilter(event.target.value as CatalogStockFilter)
                    }
                  >
                    <option value="all">Tous statuts</option>
                    <option value="available">Disponibles</option>
                    <option value="out_of_stock">Rupture</option>
                  </select>
                </label>
              </div>

              {showAdvancedTools ? (
                <div className="admin-bulk-panel">
                  <label className="inline-toggle">
                    <input
                      type="checkbox"
                      checked={areAllFilteredProductsSelected}
                      onChange={toggleAllFilteredProducts}
                    />
                    Tout sélectionner
                  </label>
                  <p className="admin-help">
                    {selectedProductIds.size} article(s) sélectionné(s)
                  </p>
                  <div className="admin-bulk-actions">
                    <button
                      type="button"
                      className="chip"
                      disabled={!selectedProductIds.size || bulkProductsBusy}
                      onClick={() => void handleBulkProductAction('mark_out')}
                    >
                      Rupture
                    </button>
                    <button
                      type="button"
                      className="chip"
                      disabled={!selectedProductIds.size || bulkProductsBusy}
                      onClick={() => void handleBulkProductAction('mark_available')}
                    >
                      Remettre en vente
                    </button>
                    <button
                      type="button"
                      className="chip"
                      disabled={!selectedProductIds.size || bulkProductsBusy}
                      onClick={() => void handleBulkProductAction('set_new')}
                    >
                      Tag Nouveau
                    </button>
                    <button
                      type="button"
                      className="chip"
                      disabled={!selectedProductIds.size || bulkProductsBusy}
                      onClick={() => void handleBulkProductAction('set_best')}
                    >
                      Tag Best seller
                    </button>
                    <button
                      type="button"
                      className="chip chip--clear"
                      disabled={!selectedProductIds.size || bulkProductsBusy}
                      onClick={() => void handleBulkProductAction('unset_new')}
                    >
                      Retirer Nouveau
                    </button>
                    <button
                      type="button"
                      className="chip chip--clear"
                      disabled={!selectedProductIds.size || bulkProductsBusy}
                      onClick={() => void handleBulkProductAction('unset_best')}
                    >
                      Retirer Best seller
                    </button>
                    <button
                      type="button"
                      className="chip chip--clear danger"
                      disabled={!selectedProductIds.size || bulkProductsBusy}
                      onClick={() => void handleBulkProductAction('delete')}
                    >
                      Supprimer sélection
                    </button>
                  </div>
                </div>
              ) : null}

              {loadingProducts ? <p>Chargement...</p> : null}
              {!loadingProducts && !filteredProducts.length ? (
                <p className="admin-help">Aucun produit ne correspond aux filtres.</p>
              ) : null}

              <div className="admin-product-grid">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id}
                    className={
                      showAdvancedTools
                        ? 'admin-product-item admin-product-item--advanced'
                        : 'admin-product-item'
                    }
                  >
                    {showAdvancedTools ? (
                      <label className="admin-select">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                        />
                        <span>Sélection</span>
                      </label>
                    ) : null}
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
                      {showAdvancedTools ? (
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => void handleDuplicateProduct(product)}
                        >
                          Dupliquer
                        </button>
                      ) : null}
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
            <div className="admin-toolbar">
              <h2>Commandes clients ({filteredOrders.length})</h2>
              <div className="admin-toolbar-actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => void loadOrdersData()}
                  disabled={loadingOrders}
                >
                  Rafraîchir
                </button>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={showAdvancedTools}
                    onChange={(event) => setShowAdvancedTools(event.target.checked)}
                  />
                  Outils avancés
                </label>
              </div>
            </div>

            <div className="admin-catalog-filters">
              <label className="admin-search">
                <span>Recherche commande</span>
                <input
                  type="search"
                  placeholder="Référence, client, email, téléphone"
                  value={ordersSearch}
                  onChange={(event) => setOrdersSearch(event.target.value)}
                />
              </label>

              <label className="admin-search">
                <span>Statut</span>
                <select
                  value={ordersStatusFilter}
                  onChange={(event) =>
                    setOrdersStatusFilter(event.target.value as OrderStatus | 'all')
                  }
                >
                  <option value="all">Tous les statuts</option>
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {showAdvancedTools ? (
              <div className="admin-bulk-panel">
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={areAllFilteredOrdersSelected}
                    onChange={toggleAllFilteredOrders}
                  />
                  Tout sélectionner
                </label>

                <label className="admin-search">
                  <span>Statut groupé</span>
                  <select
                    value={bulkOrderStatus}
                    onChange={(event) =>
                      setBulkOrderStatus(event.target.value as OrderStatus)
                    }
                  >
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="button"
                  disabled={!selectedOrderIds.size || bulkOrdersBusy}
                  onClick={() => void handleBulkOrderStatusUpdate()}
                >
                  Mettre à jour {selectedOrderIds.size} commande(s)
                </button>
              </div>
            ) : null}

            {loadingOrders ? <p>Chargement...</p> : null}
            {!loadingOrders && !filteredOrders.length ? (
              <p className="admin-help">Aucune commande ne correspond aux filtres.</p>
            ) : null}

            <div className="orders-list">
              {filteredOrders.map((order) => (
                <article className="order-card" key={order.id}>
                  <div className="order-card__header">
                    <div>
                      {showAdvancedTools ? (
                        <label className="admin-select">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.has(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                          />
                          <span>Sélection</span>
                        </label>
                      ) : null}
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
