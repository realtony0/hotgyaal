import type { NextApiRequest, NextApiResponse } from 'next'
import { issueAdminToken, setAdminCookie, verifyAdminCode } from '../../../src/lib/adminAuth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Méthode non autorisée.' })
  }

  const code =
    typeof req.body === 'object' && req.body
      ? String((req.body as { code?: unknown }).code ?? '')
      : ''

  if (!verifyAdminCode(code)) {
    return res.status(401).json({ error: 'Code incorrect.' })
  }

  setAdminCookie(res, issueAdminToken())
  return res.status(200).json({ ok: true })
}
