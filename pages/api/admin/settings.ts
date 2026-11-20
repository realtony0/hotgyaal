import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../src/lib/adminAuth'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../src/lib/supabaseAdmin'

const SETTINGS_ROW_ID = 1

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) {
    return
  }
  if (!isSupabaseAdminConfigured) {
    return res.status(501).json({ error: 'Service non configuré.' })
  }
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'Méthode non autorisée.' })
  }

  const { payload } = (req.body ?? {}) as { payload?: Record<string, unknown> }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Réglages manquants.' })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('store_settings')
    .upsert({ id: SETTINGS_ROW_ID, ...payload }, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    return res.status(400).json({ error: error.message })
  }
  return res.status(200).json({ settings: data })
}
