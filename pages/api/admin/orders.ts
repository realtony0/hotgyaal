import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../src/lib/adminAuth'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../src/lib/supabaseAdmin'
import type { OrderStatus } from '../../../src/types'

const STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) {
    return
  }
  if (!isSupabaseAdminConfigured) {
    return res.status(501).json({ error: 'Service non configuré.' })
  }

  const db = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ orders: data ?? [] })
  }

  if (req.method === 'PATCH') {
    const { id, status } = (req.body ?? {}) as { id?: string; status?: OrderStatus }
    if (!id || !status || !STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Requête invalide.' })
    }
    const { error } = await db.from('orders').update({ status }).eq('id', id)
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id } = (req.body ?? {}) as { id?: string }
    if (!id) {
      return res.status(400).json({ error: 'Identifiant manquant.' })
    }
    const { error } = await db.from('orders').delete().eq('id', id)
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Méthode non autorisée.' })
}
