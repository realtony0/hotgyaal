import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useStoreCategories } from '../../context/StoreCategoriesContext'
import { useStoreSettings } from '../../context/StoreSettingsContext'
import { CATEGORY_TREE } from '../../constants/categories'
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
import { dedupeProductsBySlug } from '../../utils/products'
import { toSlug } from '../../utils/slug'

type AdminTab = 'pages' | 'categories' | 'products' | 'orders'

type CategoryOption = {
  key: string
  main: string
  sub: string
  label: string
}

type CategoryForm = {
  name: string
  slug: string
  description: string
  subcategories: string
  is_active: boolean
  display_order: string
}

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

type ColorVariantDraft = {
  id: string
  color: string
  files: File[]
}

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

const WOMEN_CATEGORY_NAME = 'Vêtements Femmes'
const WOMEN_CATEGORY_SLUG = 'vetements-femmes'

const FALLBACK_CATEGORY_OPTIONS: CategoryOption[] = CATEGORY_TREE.flatMap((category) =>
  category.subcategories.map((subCategory) => ({
    key: `${category.name}|||${subCategory}`,
    main: category.name,
    sub: subCategory,
    label: `${category.name} > ${subCategory}`,
  })),
)

const DEFAULT_CATEGORY_KEY =
  FALLBACK_CATEGORY_OPTIONS.find(
    (option) => option.main === WOMEN_CATEGORY_NAME && option.sub === 'Robes',
  )?.key ?? FALLBACK_CATEGORY_OPTIONS[0]?.key ?? 'Vêtements Femmes|||Robes'

const DEFAULT_SIZES = ['S', 'M', 'L', 'XL']

const INITIAL_CATEGORY_FORM: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  subcategories: '',
  is_active: true,
  display_order: '0',
}

const INITIAL_PRODUCT_FORM: ProductForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  compare_price: '',
  sizes: DEFAULT_SIZES.join(', '),
  categoryKey: DEFAULT_CATEGORY_KEY,
  is_out_of_stock: false,
  is_new: true,
  is_best_seller: false,
}

const parseCsv = (raw: string) =>
  Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )

const formatCsv = (values: string[]) => values.join(', ')

const createVariantDraft = (): ColorVariantDraft => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  color: '',
  files: [],
})

const buildUniqueSlug = (baseSlug: string, usedSlugs: Set<string>) => {
  let candidate = baseSlug
  let index = 2

  while (usedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${index}`
    index += 1
  }

  usedSlugs.add(candidate)
  return candidate
}

const buildCategoryOptions = (categories: StoreCategory[]): CategoryOption[] => {
  const source = categories.length
    ? categories.filter((category) => category.is_active)
    : []

  const options = source.flatMap((category) =>
    category.subcategories.map((subCategory) => ({
      key: `${category.name}|||${subCategory}`,
      main: category.name,
      sub: subCategory,
      label: `${category.name} > ${subCategory}`,
    })),
  )

  return options.length ? options : FALLBACK_CATEGORY_OPTIONS
}

const getCategoryFromKey = (key: string, options: CategoryOption[]) =>
  options.find((option) => option.key === key) ?? options[0]

const getCategoryKeyFromProduct = (
  product: Product,
  options: CategoryOption[],
) => {
  const option = options.find(
    (entry) =>
      entry.main === product.main_category && entry.sub === product.sub_category,
  )

  return option?.key ?? options[0]?.key ?? DEFAULT_CATEGORY_KEY
}

export const AdminDashboardPage = () => {
  const { profile, signOut } = useAuth()
  const {
    categories,
    loading: loadingCategories,
    error: categoriesError,
    refreshCategories,
  } = useStoreCategories()
  const {
    settings,
    loading: loadingSettings,
    error: settingsError,
    saveSettings,
  } = useStoreSettings()

  const [activeTab, setActiveTab] = useState<AdminTab>('pages')

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [siteForm, setSiteForm] = useState<StoreSettingsPayload>(settings)
  const [savingPages, setSavingPages] = useState(false)

  const [categoryForm, setCategoryForm] = useState<CategoryForm>(INITIAL_CATEGORY_FORM)
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null)
  const [selectedCategoryImage, setSelectedCategoryImage] = useState<File | null>(null)
  const [savingCategory, setSavingCategory] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [savingProduct, setSavingProduct] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState('all')

  const [productForm, setProductForm] = useState<ProductForm>(INITIAL_PRODUCT_FORM)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isAdvancedMode, setIsAdvancedMode] = useState(false)
  const [isMultiColorMode, setIsMultiColorMode] = useState(true)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<File[]>([])
  const [colorVariants, setColorVariants] = useState<ColorVariantDraft[]>([
    createVariantDraft(),
  ])

  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [ordersSearch, setOrdersSearch] = useState('')
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(new Set())

  const [clothingTypesInput, setClothingTypesInput] = useState('')
  const [savingClothingTypes, setSavingClothingTypes] = useState(false)

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
    const womenOnly = categoryOptions.filter(
      (option) => option.main === WOMEN_CATEGORY_NAME,
    )

    return womenOnly.length ? womenOnly : categoryOptions
  }, [categoryOptions])

  const selectedProductCategory = useMemo(
    () => getCategoryFromKey(productForm.categoryKey, categoryOptions),
    [productForm.categoryKey, categoryOptions],
  )

  const availableSubcategories = useMemo(
    () =>
      categoryOptions
        .filter((option) => option.main === selectedProductCategory?.main)
        .map((option) => option.sub),
    [categoryOptions, selectedProductCategory],
  )

  const productStats = useMemo(() => {
    const out = products.filter((product) => product.is_out_of_stock).length
    return {
      total: products.length,
      available: products.length - out,
      out,
    }
  }, [products])

  const orderStats = useMemo(() => {
    const pending = orders.filter((order) => order.status === 'pending').length
    const processing = orders.filter((order) => order.status === 'processing').length

    return {
      total: orders.length,
      pending,
      processing,
    }
  }, [orders])

  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        !normalized ||
        [product.name, product.main_category, product.sub_category, product.slug]
          .join(' ')
          .toLowerCase()
          .includes(normalized)

      const matchesCategory =
        productCategoryFilter === 'all' || product.main_category === productCategoryFilter

      return matchesSearch && matchesCategory
    })
  }, [productCategoryFilter, productSearch, products])

  const filteredOrders = useMemo(() => {
    const normalized = ordersSearch.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesSearch =
        !normalized ||
        [
          order.order_number,
          order.customer_name,
          order.customer_phone,
          order.customer_email,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalized)

      const matchesStatus =
        ordersStatusFilter === 'all' || order.status === ordersStatusFilter

      return matchesSearch && matchesStatus
    })
  }, [orders, ordersSearch, ordersStatusFilter])

  useEffect(() => {
    setSiteForm(settings)
  }, [settings])

  useEffect(() => {
    setClothingTypesInput((womenCategory?.subcategories ?? []).join(', '))
  }, [womenCategory])

  useEffect(() => {
    const optionsSource = isAdvancedMode ? categoryOptions : simpleCategoryOptions

    setProductForm((current) => {
      const found = optionsSource.some((option) => option.key === current.categoryKey)
      if (found) {
        return current
      }

      return {
        ...current,
        categoryKey: optionsSource[0]?.key ?? DEFAULT_CATEGORY_KEY,
      }
    })
  }, [categoryOptions, isAdvancedMode, simpleCategoryOptions])

  useEffect(() => {
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
          error instanceof Error
            ? error.message
            : 'Impossible de charger les commandes.',
        )
      } finally {
        setLoadingOrders(false)
      }
    }

    void loadProductsData()
    void loadOrdersData()
  }, [])

  const resetMessages = () => {
    setErrorMessage(null)
    setStatusMessage(null)
  }

  const refreshProducts = async () => {
    const data = await listProducts()
    setProducts(dedupeProductsBySlug(data))
  }

  const refreshOrders = async () => {
    const data = await listOrders()
    setOrders(data)
  }

  const resetCategoryForm = () => {
    setCategoryForm({
      ...INITIAL_CATEGORY_FORM,
      display_order: String(categories.length),
    })
    setEditingCategory(null)
    setSelectedCategoryImage(null)
  }

  const resetProductForm = () => {
    setProductForm({
      ...INITIAL_PRODUCT_FORM,
      categoryKey: simpleCategoryOptions[0]?.key ?? DEFAULT_CATEGORY_KEY,
    })
    setEditingProduct(null)
    setSelectedImage(null)
    setSelectedGalleryImages([])
    setIsAdvancedMode(false)
    setIsMultiColorMode(true)
    setColorVariants([createVariantDraft()])
  }

  const uploadFiles = async (files: File[]) => {
    const urls: string[] = []

    for (const file of files) {
      const url = await uploadProductImage(file)
      urls.push(url)
    }

    return urls
  }

  const buildProductPayload = (
    product: Product,
    patch: Partial<ProductPayload> = {},
  ): ProductPayload => ({
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
    sizes: patch.sizes ?? product.sizes,
    is_out_of_stock:
      patch.is_out_of_stock === undefined
        ? product.is_out_of_stock
        : patch.is_out_of_stock,
    is_new: patch.is_new === undefined ? product.is_new : patch.is_new,
    is_best_seller:
      patch.is_best_seller === undefined ? product.is_best_seller : patch.is_best_seller,
  })

  const buildCategoryPayload = (
    category: StoreCategory,
    patch: Partial<StoreCategoryPayload> = {},
  ): StoreCategoryPayload => ({
    slug: patch.slug ?? category.slug,
    name: patch.name ?? category.name,
    description: patch.description ?? category.description,
    image_url: patch.image_url === undefined ? category.image_url : patch.image_url,
    subcategories: patch.subcategories ?? category.subcategories,
    is_active: patch.is_active === undefined ? category.is_active : patch.is_active,
    display_order:
      patch.display_order === undefined
        ? category.display_order
        : patch.display_order,
  })

  const handleSavePages = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      resetMessages()
      setSavingPages(true)
      await saveSettings(siteForm)
      setStatusMessage('Pages du site mises a jour.')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de sauvegarder les pages.',
      )
    } finally {
      setSavingPages(false)
    }
  }

  const handleSaveClothingTypes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      resetMessages()
      setSavingClothingTypes(true)

      const subcategories = parseCsv(clothingTypesInput)
      if (!subcategories.length) {
        throw new Error('Ajoutez au moins un type de vetement.')
      }

      if (womenCategory) {
        await upsertCategory(
          buildCategoryPayload(womenCategory, {
            subcategories,
          }),
          womenCategory.id,
        )

        const impacted = products.filter(
          (product) =>
            product.main_category === womenCategory.name &&
            !subcategories.includes(product.sub_category),
        )

        for (const product of impacted) {
          await upsertProduct(
            buildProductPayload(product, {
              sub_category: subcategories[0],
            }),
            product.id,
          )
        }
      } else {
        const usedSlugs = new Set(categories.map((category) => category.slug))

        await upsertCategory({
          slug: buildUniqueSlug(WOMEN_CATEGORY_SLUG, usedSlugs),
          name: WOMEN_CATEGORY_NAME,
          description: 'Selection mode femme HOTGYAAL.',
          image_url: null,
          subcategories,
          is_active: true,
          display_order: 0,
        })
      }

      await refreshCategories()
      await refreshProducts()
      setStatusMessage('Types de vetements mis a jour.')
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

  const handleSaveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      resetMessages()
      setSavingCategory(true)

      const name = categoryForm.name.trim()
      const description = categoryForm.description.trim() || 'Categorie HOTGYAAL'
      const displayOrder = Number(categoryForm.display_order)
      const subcategories = parseCsv(categoryForm.subcategories)

      if (!name) {
        throw new Error('Nom de categorie requis.')
      }

      if (!subcategories.length) {
        throw new Error('Ajoutez au moins une sous-categorie.')
      }

      if (!Number.isFinite(displayOrder) || displayOrder < 0) {
        throw new Error('Ordre de tri invalide.')
      }

      const usedSlugs = new Set(categories.map((category) => category.slug))
      if (editingCategory?.slug) {
        usedSlugs.delete(editingCategory.slug)
      }

      const generated = toSlug(categoryForm.slug.trim() || name)
      if (!generated) {
        throw new Error('Slug categorie invalide.')
      }

      let imageUrl = editingCategory?.image_url ?? null
      if (selectedCategoryImage) {
        imageUrl = await uploadCategoryImage(selectedCategoryImage)
      } else if (!editingCategory) {
        throw new Error('Ajoutez une image de categorie.')
      }

      await upsertCategory(
        {
          slug: buildUniqueSlug(generated, usedSlugs),
          name,
          description,
          image_url: imageUrl,
          subcategories,
          is_active: categoryForm.is_active,
          display_order: Math.trunc(displayOrder),
        },
        editingCategory?.id,
      )

      if (editingCategory && editingCategory.name !== name) {
        const impacted = products.filter(
          (product) => product.main_category === editingCategory.name,
        )

        for (const product of impacted) {
          await upsertProduct(
            buildProductPayload(product, {
              main_category: name,
              sub_category: subcategories.includes(product.sub_category)
                ? product.sub_category
                : subcategories[0],
            }),
            product.id,
          )
        }
      }

      await refreshCategories()
      await refreshProducts()
      setStatusMessage(editingCategory ? 'Categorie mise a jour.' : 'Categorie ajoutee.')
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

  const handleToggleCategory = async (category: StoreCategory) => {
    try {
      resetMessages()
      await upsertCategory(
        buildCategoryPayload(category, {
          is_active: !category.is_active,
        }),
        category.id,
      )
      await refreshCategories()
      setStatusMessage(category.is_active ? 'Categorie desactivee.' : 'Categorie activee.')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de changer le statut de la categorie.',
      )
    }
  }

  const handleDeleteCategory = async (category: StoreCategory) => {
    const usedByProducts = products.some(
      (product) => product.main_category === category.name,
    )

    if (usedByProducts) {
      setErrorMessage(
        'Cette categorie est liee a des produits. Reclasser les produits avant suppression.',
      )
      return
    }

    const confirmDelete = window.confirm(`Supprimer ${category.name} ?`)
    if (!confirmDelete) {
      return
    }

    try {
      resetMessages()
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
          : 'Impossible de supprimer cette categorie.',
      )
    }
  }

  const handleSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      resetMessages()
      setSavingProduct(true)

      const name = productForm.name.trim()
      const description = productForm.description.trim() || 'Article premium HOTGYAAL.'
      const price = Number(productForm.price)
      const comparePrice = productForm.compare_price.trim()
        ? Number(productForm.compare_price)
        : null
      const sizes = parseCsv(productForm.sizes)
      const category = getCategoryFromKey(productForm.categoryKey, categoryOptions)
      const stock = productForm.is_out_of_stock ? 0 : 999

      if (!name) {
        throw new Error('Nom du produit requis.')
      }

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Prix invalide.')
      }

      if (!sizes.length) {
        throw new Error('Ajoutez au moins une taille.')
      }

      if (
        comparePrice !== null &&
        (!Number.isFinite(comparePrice) || comparePrice < 0)
      ) {
        throw new Error('Prix barre invalide.')
      }

      const usedSlugs = new Set(products.map((product) => product.slug))
      if (editingProduct?.slug) {
        usedSlugs.delete(editingProduct.slug)
      }

      if (isMultiColorMode && !editingProduct) {
        const rows = colorVariants
          .map((row, index) => ({
            ...row,
            color: row.color.trim(),
            fallback: `Couleur ${index + 1}`,
          }))
          .filter((row) => row.color || row.files.length)

        if (!rows.length) {
          throw new Error('Ajoutez au moins une couleur avec des photos.')
        }

        const baseSlug = toSlug(productForm.slug.trim() || name)
        if (!baseSlug) {
          throw new Error('Slug produit invalide.')
        }

        let createdCount = 0

        for (const row of rows) {
          if (!row.files.length) {
            throw new Error(`Ajoutez au moins une photo pour ${row.color || row.fallback}.`)
          }

          const uploaded = await uploadFiles(row.files)
          const images = Array.from(new Set(uploaded))
          const effectiveColor = row.color || (rows.length > 1 ? row.fallback : '')

          const variantSlug = effectiveColor
            ? buildUniqueSlug(`${baseSlug}-${toSlug(effectiveColor) || 'couleur'}`, usedSlugs)
            : buildUniqueSlug(baseSlug, usedSlugs)

          await upsertProduct({
            name: effectiveColor ? `${name} - ${effectiveColor}` : name,
            slug: variantSlug,
            description,
            price,
            compare_price: comparePrice,
            stock,
            main_category: category.main,
            sub_category: category.sub,
            image_url: images[0],
            gallery_urls: images.slice(1),
            sizes,
            is_out_of_stock: productForm.is_out_of_stock,
            is_new: productForm.is_new,
            is_best_seller: productForm.is_best_seller,
          })

          createdCount += 1
        }

        await refreshProducts()
        setStatusMessage(`${createdCount} article(s) couleur ajoutes.`)
        resetProductForm()
        return
      }

      let imageUrl = editingProduct?.image_url ?? null

      if (selectedImage) {
        imageUrl = await uploadProductImage(selectedImage)
      } else if (!editingProduct) {
        throw new Error('Photo principale requise pour un nouveau produit.')
      }

      const uploadedGallery =
        selectedGalleryImages.length > 0
          ? await uploadFiles(selectedGalleryImages)
          : null

      const generatedSlug = toSlug(productForm.slug.trim() || name)
      if (!generatedSlug) {
        throw new Error('Slug produit invalide.')
      }

      await upsertProduct(
        {
          name,
          slug: buildUniqueSlug(generatedSlug, usedSlugs),
          description,
          price,
          compare_price: comparePrice,
          stock,
          main_category: category.main,
          sub_category: category.sub,
          image_url: imageUrl,
          gallery_urls: uploadedGallery ?? (editingProduct?.gallery_urls ?? []),
          sizes,
          is_out_of_stock: productForm.is_out_of_stock,
          is_new: productForm.is_new,
          is_best_seller: productForm.is_best_seller,
        },
        editingProduct?.id,
      )

      await refreshProducts()
      setStatusMessage(editingProduct ? 'Produit mis a jour.' : 'Produit ajoute.')
      resetProductForm()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de sauvegarder le produit.',
      )
    } finally {
      setSavingProduct(false)
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setIsAdvancedMode(true)
    setIsMultiColorMode(false)
    setSelectedImage(null)
    setSelectedGalleryImages([])
    setColorVariants([createVariantDraft()])

    setProductForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: String(product.price),
      compare_price: product.compare_price ? String(product.compare_price) : '',
      sizes: formatCsv(product.sizes.length ? product.sizes : DEFAULT_SIZES),
      categoryKey: getCategoryKeyFromProduct(product, categoryOptions),
      is_out_of_stock: product.is_out_of_stock,
      is_new: product.is_new,
      is_best_seller: product.is_best_seller,
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteProduct = async (product: Product) => {
    const confirmDelete = window.confirm(`Supprimer ${product.name} ?`)
    if (!confirmDelete) {
      return
    }

    try {
      resetMessages()
      await removeProduct(product.id)
      await refreshProducts()
      setStatusMessage('Produit supprime.')
      if (editingProduct?.id === product.id) {
        resetProductForm()
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de supprimer ce produit.',
      )
    }
  }

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
  ) => {
    try {
      resetMessages()
      setUpdatingOrderIds((current) => new Set(current).add(orderId))
      await updateOrderStatus(orderId, status)
      await refreshOrders()
      setStatusMessage('Statut commande mis a jour.')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de mettre a jour la commande.',
      )
    } finally {
      setUpdatingOrderIds((current) => {
        const next = new Set(current)
        next.delete(orderId)
        return next
      })
    }
  }

  const quickSteps = [
    '1. Renseigner Accueil/Contact/Footer dans l onglet Pages.',
    '2. Definir categories et types de vetements dans l onglet Categories.',
    '3. Ajouter les produits avec photos et couleurs dans l onglet Produits.',
    '4. Suivre les commandes et statuts dans l onglet Commandes.',
  ]

  return (
    <section className="section admin-page-v2">
      <div className="container">
        <div className="admin-shell-v2">
          <header className="admin-head-v2">
            <div>
              <p className="eyebrow">HOTGYAAL Admin</p>
              <h1>Pilotage complet du site</h1>
              <p>
                Connecte au front en direct: pages, categories, produits, commandes.
              </p>
            </div>

            <div className="admin-head-v2__actions">
              <span>{profile?.full_name || 'Admin'}</span>
              <button type="button" className="button button--ghost" onClick={signOut}>
                Deconnexion
              </button>
            </div>
          </header>

          <div className="admin-kpi-grid admin-kpi-grid--v2">
            <article className="admin-kpi-card">
              <p>Produits</p>
              <strong>{productStats.total}</strong>
              <span>{productStats.available} disponibles</span>
            </article>
            <article className="admin-kpi-card">
              <p>Commandes</p>
              <strong>{orderStats.total}</strong>
              <span>{orderStats.pending} en attente</span>
            </article>
            <article className="admin-kpi-card">
              <p>Categories</p>
              <strong>{categories.length}</strong>
              <span>
                {categories.filter((category) => category.is_active).length} actives
              </span>
            </article>
            <article className="admin-kpi-card">
              <p>Mises a jour</p>
              <strong>{formatDate(new Date().toISOString())}</strong>
              <span>{orderStats.processing} en traitement</span>
            </article>
          </div>

          {statusMessage ? <p className="success-text">{statusMessage}</p> : null}
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          {settingsError ? <p className="error-text">{settingsError}</p> : null}
          {categoriesError ? <p className="error-text">{categoriesError}</p> : null}

          <div className="admin-tabs-v2">
            <button
              type="button"
              className={activeTab === 'pages' ? 'chip chip--active' : 'chip'}
              onClick={() => setActiveTab('pages')}
            >
              Pages
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

          {activeTab === 'pages' ? (
            <>
              <article className="admin-card">
                <h2>Guide rapide</h2>
                <div className="admin-step-grid">
                  {quickSteps.map((step) => (
                    <article key={step} className="admin-step-card">
                      <p>{step}</p>
                    </article>
                  ))}
                </div>
              </article>

              <article className="admin-card">
                <h2>Edition des pages</h2>
                {loadingSettings ? <p className="admin-help">Chargement des pages...</p> : null}

                <form className="admin-form admin-site-form" onSubmit={handleSavePages}>
                  <label className="full-width">
                    Bandeau annonce
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
                    Hero - petit titre
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
                    Hero - titre principal
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
                    Hero - description
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
                    Page contact - texte intro
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
                    Telephone
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
                    Email
                    <input
                      required
                      type="email"
                      value={siteForm.contact_email}
                      onChange={(event) =>
                        setSiteForm((state) => ({
                          ...state,
                          contact_email: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Horaires
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

                  <label>
                    Numero commande
                    <input
                      required
                      value={siteForm.order_chat_number}
                      onChange={(event) =>
                        setSiteForm((state) => ({
                          ...state,
                          order_chat_number: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="full-width">
                    Footer - texte
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

                  <div className="admin-form-actions full-width">
                    <button type="submit" className="button" disabled={savingPages}>
                      {savingPages ? 'Enregistrement...' : 'Sauvegarder les pages'}
                    </button>
                  </div>
                </form>
              </article>
            </>
          ) : null}

          {activeTab === 'categories' ? (
            <>
              <article className="admin-card">
                <h2>Types de vetements (Vêtements Femmes)</h2>
                <p className="admin-help">
                  Mettez les types de vetements separes par virgules. Exemple: Robes,
                  Tops, T-shirts.
                </p>

                <form className="admin-form admin-form--single" onSubmit={handleSaveClothingTypes}>
                  <label className="full-width">
                    Types de vetements
                    <textarea
                      rows={3}
                      required
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
                        : 'Sauvegarder les types'}
                    </button>
                  </div>
                </form>
              </article>

              <article className="admin-card">
                <h2>{editingCategory ? 'Modifier categorie' : 'Ajouter categorie'}</h2>
                {loadingCategories ? <p className="admin-help">Chargement categories...</p> : null}

                <form className="admin-form" onSubmit={handleSaveCategory}>
                  <label>
                    Nom categorie
                    <input
                      required
                      value={categoryForm.name}
                      onChange={(event) =>
                        setCategoryForm((state) => ({ ...state, name: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Slug (optionnel)
                    <input
                      value={categoryForm.slug}
                      onChange={(event) =>
                        setCategoryForm((state) => ({ ...state, slug: event.target.value }))
                      }
                    />
                  </label>

                  <label className="full-width">
                    Description
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
                    Sous-categories (virgules)
                    <input
                      required
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
                          ? 'Mettre a jour'
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
                <div className="admin-toolbar">
                  <h2>Liste categories ({categories.length})</h2>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => void refreshCategories()}
                  >
                    Rafraichir
                  </button>
                </div>

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
                      />

                      <div>
                        <h3>{category.name}</h3>
                        <p className="admin-product-meta">{category.description}</p>
                        <p className="admin-product-meta">
                          Sous-categories: {category.subcategories.join(', ')}
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
                          onClick={() => void handleToggleCategory(category)}
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
          ) : null}

          {activeTab === 'products' ? (
            <>
              <article className="admin-card">
                <div className="admin-toolbar">
                  <div>
                    <h2>{editingProduct ? 'Modifier produit' : 'Ajouter produit'}</h2>
                    <p className="admin-help">
                      Upload image obligatoire. Ajoutez plusieurs couleurs avec plusieurs
                      photos si besoin.
                    </p>
                  </div>

                  <div className="admin-toggle-row">
                    <label className="inline-toggle">
                      <input
                        type="checkbox"
                        checked={isAdvancedMode}
                        onChange={(event) => setIsAdvancedMode(event.target.checked)}
                      />
                      Mode avance
                    </label>

                    {!editingProduct ? (
                      <label className="inline-toggle">
                        <input
                          type="checkbox"
                          checked={isMultiColorMode}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setIsMultiColorMode(checked)
                            if (checked) {
                              setSelectedImage(null)
                              setSelectedGalleryImages([])
                            }
                          }}
                        />
                        Multi-couleurs
                      </label>
                    ) : null}
                  </div>
                </div>

                <form className="admin-form" onSubmit={handleSaveProduct}>
                  <label className="full-width">
                    Nom produit
                    <input
                      required
                      value={productForm.name}
                      onChange={(event) =>
                        setProductForm((state) => ({ ...state, name: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Prix (XOF)
                    <input
                      required
                      type="number"
                      min="1"
                      value={productForm.price}
                      onChange={(event) =>
                        setProductForm((state) => ({ ...state, price: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Prix barre (optionnel)
                    <input
                      type="number"
                      min="0"
                      value={productForm.compare_price}
                      onChange={(event) =>
                        setProductForm((state) => ({
                          ...state,
                          compare_price: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="full-width">
                    Tailles (virgules)
                    <input
                      required
                      value={productForm.sizes}
                      onChange={(event) =>
                        setProductForm((state) => ({ ...state, sizes: event.target.value }))
                      }
                    />
                  </label>

                  {!isAdvancedMode ? (
                    <label className="full-width">
                      Type / categorie
                      <select
                        value={productForm.categoryKey}
                        onChange={(event) =>
                          setProductForm((state) => ({
                            ...state,
                            categoryKey: event.target.value,
                          }))
                        }
                      >
                        {simpleCategoryOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.main === WOMEN_CATEGORY_NAME ? option.sub : option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <label>
                        Categorie principale
                        <select
                          value={selectedProductCategory?.main}
                          onChange={(event) => {
                            const nextMain = event.target.value
                            const firstSub =
                              categoryOptions.find((entry) => entry.main === nextMain)?.sub ||
                              'General'

                            setProductForm((state) => ({
                              ...state,
                              categoryKey: `${nextMain}|||${firstSub}`,
                            }))
                          }}
                        >
                          {Array.from(new Set(categoryOptions.map((entry) => entry.main))).map(
                            (main) => (
                              <option key={main} value={main}>
                                {main}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label>
                        Sous-categorie
                        <select
                          value={selectedProductCategory?.sub}
                          onChange={(event) =>
                            setProductForm((state) => ({
                              ...state,
                              categoryKey: `${selectedProductCategory?.main || ''}|||${event.target.value}`,
                            }))
                          }
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

                  {!isMultiColorMode ? (
                    <>
                      <label className="full-width">
                        Photo principale
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
                    </>
                  ) : (
                    <div className="full-width admin-variant-list">
                      <p className="admin-help">
                        Ajoutez une couleur puis plusieurs photos pour cette couleur.
                      </p>

                      {colorVariants.map((variant, index) => (
                        <article key={variant.id} className="admin-variant-card">
                          <div className="admin-variant-head">
                            <h3>Couleur {index + 1}</h3>
                            {colorVariants.length > 1 ? (
                              <button
                                type="button"
                                className="button button--ghost"
                                onClick={() =>
                                  setColorVariants((current) => {
                                    const next = current.filter((entry) => entry.id !== variant.id)
                                    return next.length ? next : [createVariantDraft()]
                                  })
                                }
                              >
                                Retirer
                              </button>
                            ) : null}
                          </div>

                          <label>
                            Nom couleur (optionnel si 1 seule)
                            <input
                              value={variant.color}
                              onChange={(event) =>
                                setColorVariants((current) =>
                                  current.map((entry) =>
                                    entry.id === variant.id
                                      ? { ...entry, color: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </label>

                          <label>
                            Photos couleur
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(event) =>
                                setColorVariants((current) =>
                                  current.map((entry) =>
                                    entry.id === variant.id
                                      ? {
                                          ...entry,
                                          files: Array.from(event.target.files ?? []),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </label>

                          <p className="admin-help">
                            {variant.files.length
                              ? `${variant.files.length} photo(s) selectionnee(s)`
                              : 'Aucune photo selectionnee'}
                          </p>
                        </article>
                      ))}

                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() =>
                          setColorVariants((current) => [...current, createVariantDraft()])
                        }
                      >
                        Ajouter une couleur
                      </button>
                    </div>
                  )}

                  <label className="full-width">
                    Description produit
                    <textarea
                      rows={3}
                      required
                      value={productForm.description}
                      onChange={(event) =>
                        setProductForm((state) => ({
                          ...state,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Slug (optionnel)
                    <input
                      value={productForm.slug}
                      onChange={(event) =>
                        setProductForm((state) => ({ ...state, slug: event.target.value }))
                      }
                    />
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={productForm.is_out_of_stock}
                      onChange={(event) =>
                        setProductForm((state) => ({
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
                      checked={productForm.is_new}
                      onChange={(event) =>
                        setProductForm((state) => ({
                          ...state,
                          is_new: event.target.checked,
                        }))
                      }
                    />
                    Nouveau
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={productForm.is_best_seller}
                      onChange={(event) =>
                        setProductForm((state) => ({
                          ...state,
                          is_best_seller: event.target.checked,
                        }))
                      }
                    />
                    Best seller
                  </label>

                  <div className="admin-form-actions full-width">
                    <button type="submit" className="button" disabled={savingProduct}>
                      {savingProduct
                        ? 'Enregistrement...'
                        : editingProduct
                          ? 'Mettre a jour produit'
                          : 'Ajouter produit'}
                    </button>

                    {editingProduct ? (
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={resetProductForm}
                      >
                        Annuler
                      </button>
                    ) : null}
                  </div>
                </form>
              </article>

              <article className="admin-card">
                <div className="admin-toolbar">
                  <h2>Catalogue ({products.length})</h2>

                  <div className="admin-toolbar-actions">
                    <label className="admin-search">
                      Recherche
                      <input
                        type="search"
                        placeholder="Nom, slug, categorie"
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                      />
                    </label>

                    <label className="admin-search">
                      Categorie
                      <select
                        value={productCategoryFilter}
                        onChange={(event) => setProductCategoryFilter(event.target.value)}
                      >
                        <option value="all">Toutes</option>
                        {Array.from(new Set(products.map((product) => product.main_category))).map(
                          (categoryName) => (
                            <option key={categoryName} value={categoryName}>
                              {categoryName}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                </div>

                {loadingProducts ? <p>Chargement des produits...</p> : null}
                {!loadingProducts && filteredProducts.length === 0 ? (
                  <p>Aucun produit trouve.</p>
                ) : null}

                <div className="admin-product-grid">
                  {filteredProducts.map((product) => (
                    <article key={product.id} className="admin-product-item admin-product-item--advanced">
                      <label className="admin-select">
                        <input type="checkbox" checked={false} disabled />
                        Selection
                      </label>

                      <img
                        src={
                          product.image_url ||
                          'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=500&q=80'
                        }
                        alt={product.name}
                        loading="lazy"
                      />

                      <div>
                        <h3>{product.name}</h3>
                        <p className="admin-product-meta">
                          {product.main_category} · {product.sub_category}
                        </p>
                        <p className="admin-product-meta">{formatCurrency(product.price)}</p>
                        <p className="admin-product-meta">Tailles: {product.sizes.join(', ')}</p>
                        <p className="admin-product-meta">
                          Statut: {product.is_out_of_stock ? 'Rupture' : 'Disponible'}
                        </p>
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
                          className="button button--ghost"
                          onClick={() =>
                            void upsertProduct(
                              {
                                ...buildProductPayload(product, {
                                  is_out_of_stock: !product.is_out_of_stock,
                                  stock: product.is_out_of_stock ? 999 : 0,
                                }),
                              },
                              product.id,
                            )
                              .then(refreshProducts)
                              .then(() =>
                                setStatusMessage(
                                  product.is_out_of_stock
                                    ? 'Produit marque disponible.'
                                    : 'Produit marque en rupture.',
                                ),
                              )
                              .catch((error) =>
                                setErrorMessage(
                                  error instanceof Error
                                    ? error.message
                                    : 'Mise a jour stock impossible.',
                                ),
                              )
                          }
                        >
                          {product.is_out_of_stock ? 'Remettre dispo' : 'Marquer rupture'}
                        </button>

                        <button
                          type="button"
                          className="button button--ghost danger"
                          onClick={() => void handleDeleteProduct(product)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </>
          ) : null}

          {activeTab === 'orders' ? (
            <article className="admin-card">
              <div className="admin-toolbar">
                <h2>Commandes ({orders.length})</h2>

                <div className="admin-toolbar-actions">
                  <label className="admin-search">
                    Recherche
                    <input
                      type="search"
                      placeholder="Numero, client, telephone"
                      value={ordersSearch}
                      onChange={(event) => setOrdersSearch(event.target.value)}
                    />
                  </label>

                  <label className="admin-search">
                    Statut
                    <select
                      value={ordersStatusFilter}
                      onChange={(event) =>
                        setOrdersStatusFilter(event.target.value as OrderStatus | 'all')
                      }
                    >
                      <option value="all">Tous</option>
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {loadingOrders ? <p>Chargement des commandes...</p> : null}
              {!loadingOrders && filteredOrders.length === 0 ? (
                <p>Aucune commande trouvee.</p>
              ) : null}

              <div className="orders-list">
                {filteredOrders.map((order) => (
                  <article key={order.id} className="order-card">
                    <div className="order-card__header">
                      <div>
                        <strong>{order.order_number}</strong>
                        <p>
                          {order.customer_name} · {order.customer_phone || 'Sans numero'}
                        </p>
                      </div>

                      <div>
                        <p>{formatDate(order.created_at)}</p>
                        <strong>{formatCurrency(order.total_amount)}</strong>
                      </div>
                    </div>

                    {order.order_items?.length ? (
                      <div className="order-card__items">
                        {order.order_items.map((item) => (
                          <div key={item.id}>
                            <span>
                              {item.product_name}
                              {item.selected_size ? ` (${item.selected_size})` : ''} x
                              {item.quantity}
                            </span>
                            <strong>{formatCurrency(item.subtotal)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <address>
                      {order.shipping_address.line1}
                      {order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ''}
                      , {order.shipping_address.city}, {order.shipping_address.country}
                    </address>

                    <label className="admin-search">
                      Statut commande
                      <select
                        value={order.status}
                        disabled={updatingOrderIds.has(order.id)}
                        onChange={(event) =>
                          void handleUpdateOrderStatus(
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
                    </label>
                  </article>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  )
}
