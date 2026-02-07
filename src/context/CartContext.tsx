import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { CartItem, Product } from '../types'

type CartContextValue = {
  items: CartItem[]
  totalItems: number
  subtotal: number
  addToCart: (product: Product, selectedSize: string, quantity?: number) => void
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

const getLineId = (productId: string, selectedSize: string) =>
  `${productId}::${selectedSize.toLowerCase()}`

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
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const candidate = item as Partial<CartItem>
        const product = candidate.product
        if (!product?.id) {
          return null
        }

        const selectedSize = resolveSize(product, candidate.selected_size)
        const lineId = candidate.line_id || getLineId(product.id, selectedSize)
        const quantity =
          typeof candidate.quantity === 'number' && candidate.quantity > 0
            ? candidate.quantity
            : 1

        return {
          line_id: lineId,
          product,
          selected_size: selectedSize,
          quantity,
        } satisfies CartItem
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

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>(getInitialCart)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addToCart = (product: Product, selectedSize: string, quantity = 1) => {
    const safeQuantity = Math.max(1, quantity)
    const size = resolveSize(product, selectedSize)
    const lineId = getLineId(product.id, size)

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

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0,
  )

  const value: CartContextValue = {
    items,
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
