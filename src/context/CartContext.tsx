import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { CartItem, Product, SelectedColor } from '../types'

type CartContextValue = {
  items: CartItem[]
  totalItems: number
  subtotal: number
  addToCart: (
    product: Product,
    selectedSize: string,
    quantity?: number,
    selectedColor?: SelectedColor | null,
  ) => void
  removeFromCart: (lineId: string) => void
  updateQuantity: (lineId: string, quantity: number) => void
  clearCart: () => void
}

const STORAGE_KEY = 'hotgyaal_cart'

const CartContext = createContext<CartContextValue | undefined>(undefined)

type CartProviderProps = {
  children: ReactNode
}

const FALLBACK_SIZE = 'Taille unique'

const resolveSize = (product: Product, selectedSize?: string | null) => {
  const normalized = selectedSize?.trim()
  if (normalized) {
    return normalized
  }

  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    return product.sizes[0]
  }

  return FALLBACK_SIZE
}

const getLineId = (
  productId: string,
  selectedSize: string,
  selectedColor?: SelectedColor | null,
) =>
  selectedColor
    ? `${productId}::${selectedSize.toLowerCase()}::c${selectedColor.index}`
    : `${productId}::${selectedSize.toLowerCase()}`

const isSelectedColor = (value: unknown): value is SelectedColor => {
  if (!value || typeof value !== 'object') return false
  const color = value as SelectedColor
  return (
    typeof color.index === 'number' &&
    typeof color.label === 'string' &&
    typeof color.image_url === 'string'
  )
}

const getInitialCart = (): CartItem[] => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    const normalizedItems = parsed
      .map((item): CartItem | null => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const candidate = item as Partial<CartItem>
        const product = candidate.product
        if (!product?.id) {
          return null
        }

        const selectedSize = resolveSize(product, candidate.selected_size)
        const selectedColor = isSelectedColor(candidate.selected_color)
          ? candidate.selected_color
          : null
        const lineId = candidate.line_id || getLineId(product.id, selectedSize, selectedColor)
        const quantity =
          typeof candidate.quantity === 'number' && candidate.quantity > 0
            ? candidate.quantity
            : 1

        return {
          line_id: lineId,
          product,
          selected_size: selectedSize,
          selected_color: selectedColor,
          quantity,
        }
      })
      .filter((item): item is CartItem => item !== null)

    // Merge duplicates if old storage had several lines for same product/size.
    return normalizedItems.reduce<CartItem[]>((acc, item) => {
      const existing = acc.find((entry) => entry.line_id === item.line_id)
      if (!existing) {
        acc.push(item)
        return acc
      }

      existing.quantity += item.quantity
      return acc
    }, [])
  } catch {
    return []
  }
}

const subscribeToNothing = () => () => {}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>(getInitialCart)

  /*
   * Le panier vit dans le localStorage, donc absent du rendu serveur.
   * Ce drapeau vaut false pendant l'hydratation et true ensuite : le premier
   * rendu client reproduit ainsi exactement le HTML serveur (panier vide),
   * ce qui evite l'erreur d'hydratation de React, puis le contenu apparait.
   */
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )

  const visibleItems = hydrated ? items : []

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addToCart = (
    product: Product,
    selectedSize: string,
    quantity = 1,
    selectedColor: SelectedColor | null = null,
  ) => {
    const safeQuantity = Math.max(1, quantity)
    const size = resolveSize(product, selectedSize)
    const lineId = getLineId(product.id, size, selectedColor)

    setItems((current) => {
      const existingItem = current.find((item) => item.line_id === lineId)

      if (existingItem) {
        return current.map((item) =>
          item.line_id === lineId
            ? { ...item, quantity: item.quantity + safeQuantity }
            : item,
        )
      }

      return [
        ...current,
        {
          line_id: lineId,
          product,
          selected_size: size,
          selected_color: selectedColor,
          quantity: safeQuantity,
        },
      ]
    })
  }

  const removeFromCart = (lineId: string) => {
    setItems((current) => current.filter((item) => item.line_id !== lineId))
  }

  const updateQuantity = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(lineId)
      return
    }

    setItems((current) =>
      current.map((item) =>
        item.line_id === lineId ? { ...item, quantity } : item,
      ),
    )
  }

  const clearCart = () => {
    setItems([])
  }

  const totalItems = visibleItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = visibleItems.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0,
  )

  const value: CartContextValue = {
    items: visibleItems,
    totalItems,
    subtotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart doit être utilisé dans CartProvider.')
  }

  return context
}
