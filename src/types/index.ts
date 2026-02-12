export type UserRole = 'admin' | 'customer'

export type UserProfile = {
  id: string
  full_name: string | null
  role: UserRole
  created_at: string
}

export type Product = {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compare_price: number | null
  stock: number
  main_category: string
  sub_category: string
  image_url: string | null
  gallery_urls: string[]
  sizes: string[]
  is_out_of_stock: boolean
  is_new: boolean
  is_best_seller: boolean
  created_at: string
  updated_at: string
}

export type ProductPayload = {
  name: string
  slug: string
  description: string
  price: number
  compare_price: number | null
  stock: number
  main_category: string
  sub_category: string
  image_url: string | null
  gallery_urls: string[]
  sizes: string[]
  is_out_of_stock: boolean
  is_new: boolean
  is_best_seller: boolean
}

export type CartItem = {
  line_id: string
  product: Product
  selected_size: string
  quantity: number
}

export type ShippingAddress = {
  line1: string
  line2?: string
  city: string
  postal_code: string
  country: string
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export type OrderItem = {
  id: string
  order_id: string
  product_id: string
  product_name: string
  selected_size: string | null
  unit_price: number
  quantity: number
  subtotal: number
}

export type Order = {
  id: string
  order_number: string
  user_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  shipping_address: ShippingAddress
  status: OrderStatus
  total_amount: number
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
}

export type CheckoutPayload = {
  userId?: string | null
  customerName: string
  customerEmail: string
  customerPhone?: string
  shippingAddress: ShippingAddress
  items: CartItem[]
}

export type StoreSettings = {
  id: number
  announcement_text: string
  hero_eyebrow: string
  hero_title: string
  hero_description: string
  contact_intro: string
  contact_phone: string
  contact_email: string
  contact_hours: string
  footer_blurb: string
  order_chat_number: string
  updated_at: string
}

export type StoreSettingsPayload = Omit<StoreSettings, 'id' | 'updated_at'>
