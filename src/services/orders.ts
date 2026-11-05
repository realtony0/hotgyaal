import { getSupabase, resolveOrderErrorMessage } from '../lib/supabase'
import type { CheckoutPayload, Order, OrderStatus } from '../types'

/** Code Postgres d'une violation de cle etrangere. */
const FOREIGN_KEY_VIOLATION = '23503'

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

  const buildItems = (keepProductLink: (productId: string) => boolean) =>
    payload.items.map((item) => ({
      order_id: order.id,
      // Le lien vers la fiche n'est qu'un confort : le nom, la taille et le
      // prix sont copies dans la ligne, donc une commande reste exploitable
      // meme si l'article a disparu du catalogue entre-temps.
      product_id: keepProductLink(item.product.id) ? item.product.id : null,
      product_name: item.product.name,
      selected_size: item.selected_size,
      unit_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.quantity * item.product.price,
    }))

  /*
   * Le panier vit dans le navigateur de la cliente : il peut contenir un
   * article retire du catalogue depuis. La cle etrangere refusait alors
   * l'insertion et la commande entiere echouait, alors que la commande elle
   * meme etait deja creee. On verifie donc quels articles existent encore.
   */
  const productIds = Array.from(new Set(payload.items.map((item) => item.product.id)))
  const { data: knownProducts } = await client
    .from('products')
    .select('id')
    .in('id', productIds)

  const known = knownProducts
    ? new Set((knownProducts as { id: string }[]).map((row) => row.id))
    : null

  // Verification impossible (reseau) : on tente avec les liens d'origine.
  let { error: itemsError } = await client
    .from('order_items')
    .insert(buildItems((id) => (known ? known.has(id) : true)))

  // Filet de securite : un article supprime entre la verification et
  // l'insertion ne doit pas davantage faire perdre la commande.
  if (itemsError?.code === FOREIGN_KEY_VIOLATION) {
    ;({ error: itemsError } = await client
      .from('order_items')
      .insert(buildItems(() => false)))
  }

  if (itemsError) {
    // Sans ses lignes, la commande n'a aucune valeur : on evite de laisser une
    // coquille vide dans le back-office.
    await client
      .from('orders')
      .delete()
      .eq('id', order.id)
      .then(undefined, () => undefined)

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
