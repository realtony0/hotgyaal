import type { NextApiRequest, NextApiResponse } from 'next'
import { isAdminRequest } from '../../../src/lib/adminAuth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ isAdmin: isAdminRequest(req) })
}
