import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabase, isSupabaseConfigured } from '../../src/lib/supabase'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../src/lib/supabaseAdmin'
import type { CartItem, OrderStatus, ShippingAddress } from '../../src/types'

/*
 * Creation de commande cote serveur.
 *
 * Le navigateur n'ecrit plus jamais dans la table orders : la RLS la ferme
 * entierement au role public. La boutique poste ici la commande, et c'est la
 * cle service_role qui l'insere. On recalcule les prix depuis la base pour ne
 * pas faire confiance aux montants envoyes par le client.
 */

const FOREIGN_KEY_VIOLATION = '23503'

type IncomingItem = {
  product_id: string
  product_name: string
  selected_size: string
  quantity: number
}

type OrderRequest = {
  userId?: string | null
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  shippingAddress?: ShippingAddress
  items?: IncomingItem[]
}

const toIncomingItems = (items: CartItem[] | IncomingItem[] | undefined): IncomingItem[] => {
  if (!Array.isArray(items)) {
    return []
  }
  return items
    .map((item) => {
      const cart = item as CartItem
      if (cart.product) {
        return {
          product_id: cart.product.id,
          product_name: cart.product.name,
          selected_size: cart.selected_color
            ? `${cart.selected_size} · ${cart.selected_color.label}`
            : cart.selected_size,
          quantity: cart.quantity,
        }
      }
      const raw = item as IncomingItem
      return {
        product_id: raw.product_id,
        product_name: raw.product_name,
        selected_size: raw.selected_size,
        quantity: raw.quantity,
      }
    })
    .filter((item) => item.product_id && item.quantity > 0)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Méthode non autorisée.' })
  }
  /*
   * Cle de service absente (variable Vercel pas encore posee) : on ne bloque
   * pas les ventes. Tant que supabase/secure_rls.sql n'a pas ete execute, la
   * base accepte encore les commandes passees avec la cle publique ; on s'en
   * sert en secours. Une fois la cle posee, c'est elle qui sert.
   */
  if (!isSupabaseAdminConfigured && !isSupabaseConfigured) {
    return res.status(501).json({ error: 'Service non configuré.' })
  }

  const body = (req.body ?? {}) as OrderRequest
  const items = toIncomingItems(body.items)

  if (!items.length) {
    return res.status(400).json({ error: 'Le panier est vide.' })
  }
  if (!body.customerName?.trim()) {
    return res.status(400).json({ error: 'Le nom est requis.' })
  }

  const db = isSupabaseAdminConfigured ? getSupabaseAdmin() : getSupabase()
  if (!isSupabaseAdminConfigured) {
    console.warn('[hotgyaal] SUPABASE_SERVICE_ROLE_KEY absente : commande enregistree avec la cle publique')
  }

  // Les prix viennent de la base, pas du navigateur : un client ne fixe pas
  // le montant de sa commande.
  const productIds = Array.from(new Set(items.map((item) => item.product_id)))
  const { data: products, error: productsError } = await db
    .from('products')
    .select('id, name, price')
    .in('id', productIds)

  if (productsError) {
    return res.status(500).json({ error: productsError.message })
  }

  const priceById = new Map(
    (products ?? []).map((p) => [p.id as string, Number(p.price)]),
  )

  const lines = items.map((item) => {
    const unitPrice = priceById.get(item.product_id) ?? 0
    return {
      product_id: item.product_id,
      product_name: item.product_name,
      selected_size: item.selected_size,
      unit_price: unitPrice,
      quantity: item.quantity,
      subtotal: unitPrice * item.quantity,
    }
  })

  const totalAmount = lines.reduce((sum, line) => sum + line.subtotal, 0)

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      user_id: body.userId ?? null,
      customer_name: body.customerName,
      customer_email: body.customerEmail ?? null,
      customer_phone: body.customerPhone ?? null,
      shipping_address: body.shippingAddress ?? {},
      total_amount: totalAmount,
      status: 'pending' as OrderStatus,
    })
    .select('*')
    .single()

  if (orderError || !order) {
    return res.status(500).json({ error: orderError?.message ?? 'Insertion impossible.' })
  }

  // Un article retire du catalogue ne doit pas faire perdre la commande :
  // on garde la ligne mais sans le lien produit.
  const known = new Set(priceById.keys())
  const buildRows = (keepLink: boolean) =>
    lines.map((line) => ({
      ...line,
      order_id: order.id,
      product_id: keepLink && known.has(line.product_id) ? line.product_id : null,
    }))

  let { error: itemsError } = await db.from('order_items').insert(buildRows(true))
  if (itemsError?.code === FOREIGN_KEY_VIOLATION) {
    ;({ error: itemsError } = await db.from('order_items').insert(buildRows(false)))
  }

  if (itemsError) {
    await db.from('orders').delete().eq('id', order.id)
    return res.status(500).json({ error: itemsError.message })
  }

  return res.status(201).json({ order })
}
