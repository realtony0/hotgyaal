import { adminFetch } from './adminApi'
import type { CheckoutPayload, Order, OrderStatus } from '../types'

export const listOrders = async (): Promise<Order[]> => {
  const { orders } = await adminFetch<{ orders: Order[] }>('/api/admin/orders')
  return orders
}

export const createOrder = async (payload: CheckoutPayload): Promise<Order> => {
  if (!payload.items.length) {
    throw new Error('Le panier est vide.')
  }

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: payload.userId ?? null,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone ?? null,
      shippingAddress: payload.shippingAddress,
      items: payload.items.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        // Le coloris voyage avec la taille : la table order_items n'a pas de
        // colonne dediee, et l'administration affiche ce champ tel quel.
        selected_size: item.selected_color
          ? `${item.selected_size} · ${item.selected_color.label}`
          : item.selected_size,
        quantity: item.quantity,
      })),
    }),
  })

  const data = (await response.json().catch(() => null)) as
    | { order?: Order; error?: string }
    | null

  if (!response.ok || !data?.order) {
    throw new Error(
      data?.error ||
        "Votre commande n'a pas pu etre enregistree pour le moment. Merci de reessayer dans quelques instants ou de nous contacter directement.",
    )
  }

  return data.order
}

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
): Promise<void> => {
  await adminFetch('/api/admin/orders', {
    method: 'PATCH',
    body: JSON.stringify({ id: orderId, status }),
  })
}

export const removeOrder = async (orderId: string): Promise<void> => {
  await adminFetch('/api/admin/orders', {
    method: 'DELETE',
    body: JSON.stringify({ id: orderId }),
  })
}
