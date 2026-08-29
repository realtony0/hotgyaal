import { getSupabase, resolveOrderErrorMessage } from '../lib/supabase'
import type { CheckoutPayload, Order, OrderStatus } from '../types'

export const listOrders = async (): Promise<Order[]> => {
  const client = getSupabase()
  const { data, error } = await client
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Order[]
}

export const createOrder = async (payload: CheckoutPayload): Promise<Order> => {
  const client = getSupabase()

  if (!payload.items.length) {
    throw new Error('Le panier est vide.')
  }

  const totalAmount = payload.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  )

  const { data: order, error: orderError } = await client
    .from('orders')
    .insert({
      user_id: payload.userId ?? null,
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      customer_phone: payload.customerPhone ?? null,
      shipping_address: payload.shippingAddress,
      total_amount: totalAmount,
      status: 'pending' as OrderStatus,
    })
    .select('*')
    .single()

  if (orderError) {
    throw new Error(resolveOrderErrorMessage(orderError))
  }

  const orderItems = payload.items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    selected_size: item.selected_size,
    unit_price: item.product.price,
    quantity: item.quantity,
    subtotal: item.quantity * item.product.price,
  }))

  const { error: itemsError } = await client.from('order_items').insert(orderItems)

  if (itemsError) {
    throw new Error(resolveOrderErrorMessage(itemsError))
  }

  return order as Order
}

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
): Promise<void> => {
  const client = getSupabase()
  const { error } = await client.from('orders').update({ status }).eq('id', orderId)

  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Supprime une commande et, par cascade, ses lignes (order_items.order_id est
 * declare `on delete cascade`).
 *
 * Attention : sans politique de suppression cote base, PostgREST repond
 * malgre tout 204 sans rien effacer. On verifie donc que la ligne a bien
 * disparu, plutot que de laisser croire a une reussite.
 */
export const removeOrder = async (orderId: string): Promise<void> => {
  const client = getSupabase()

  const { data, error } = await client
    .from('orders')
    .delete()
    .eq('id', orderId)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.length) {
    throw new Error(
      "La commande n'a pas pu etre supprimee : la base a refuse l'operation. Appliquez la politique de suppression (voir supabase/full_setup.sql).",
    )
  }
}
