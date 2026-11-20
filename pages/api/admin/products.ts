import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../src/lib/adminAuth'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../src/lib/supabaseAdmin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) {
    return
  }
  if (!isSupabaseAdminConfigured) {
    return res.status(501).json({ error: 'Service non configuré.' })
  }

  const db = getSupabaseAdmin()

  if (req.method === 'POST') {
    const { payload, id } = (req.body ?? {}) as { payload?: unknown; id?: string }
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Données produit manquantes.' })
    }
    const query = id
      ? db.from('products').update(payload).eq('id', id)
      : db.from('products').insert(payload)
    const { data, error } = await query.select('*').single()
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    return res.status(200).json({ product: data })
  }

  if (req.method === 'DELETE') {
    const { id } = (req.body ?? {}) as { id?: string }
    if (!id) {
      return res.status(400).json({ error: 'Identifiant manquant.' })
    }
    const { error } = await db.from('products').delete().eq('id', id)
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'POST, DELETE')
  return res.status(405).json({ error: 'Méthode non autorisée.' })
}
