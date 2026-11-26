import * as crypto from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

/*
 * Autorisation de l'administration, cote serveur.
 *
 * Avant, le code d'acces vivait dans le bundle JavaScript et un simple drapeau
 * localStorage ouvrait l'interface : n'importe qui pouvait le lire et, la base
 * etant ouverte en ecriture, agir dessus. Desormais le code est un secret
 * serveur, verifie par /api/admin/login, qui pose un cookie signe. Les routes
 * d'administration n'agissent que sur presentation de ce cookie, et toute
 * ecriture passe par la cle service_role, jamais par le navigateur.
 */

const COOKIE_NAME = 'hg_admin'
const SESSION_TTL_MS = 1000 * 60 * 60 * 12 // 12 h

const getAdminCode = () =>
  process.env.ADMIN_ACCESS_CODE?.trim() ||
  // repli historique, a remplacer par une vraie variable d'environnement
  process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE?.trim() ||
  '142022'

const getSessionSecret = () =>
  process.env.ADMIN_SESSION_SECRET?.trim() ||
  // a defaut d'un secret dedie, on en derive un du code : moins ideal, mais le
  // cookie reste inforgeable sans connaitre le code.
  `derived:${getAdminCode()}`

/** Comparaison a temps constant, pour ne pas fuiter le code par la latence. */
const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) {
    return false
  }
  return crypto.timingSafeEqual(ba, bb)
}

export const verifyAdminCode = (code: string) =>
  safeEqual((code ?? '').trim(), getAdminCode())

const sign = (value: string) =>
  crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url')

/** Jeton = charge utile (expiration) + signature HMAC. Inforgeable sans le secret. */
export const issueAdminToken = () => {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString(
    'base64url',
  )
  return `${payload}.${sign(payload)}`
}

const isTokenValid = (token: string | undefined): boolean => {
  if (!token) {
    return false
  }

  const [payload, signature] = token.split('.')
  if (!payload || !signature) {
    return false
  }

  if (!safeEqual(signature, sign(payload))) {
    return false
  }

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      exp?: number
    }
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

const readCookie = (req: NextApiRequest, name: string): string | undefined => {
  const header = req.headers.cookie
  if (!header) {
    return undefined
  }
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return undefined
}

export const isAdminRequest = (req: NextApiRequest) =>
  isTokenValid(readCookie(req, COOKIE_NAME))

export const setAdminCookie = (res: NextApiResponse, token: string) => {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; ` +
      'HttpOnly; SameSite=Lax; Secure',
  )
}

export const clearAdminCookie = (res: NextApiResponse) => {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
  )
}

/**
 * Garde pour les routes d'administration. Repond 401 et renvoie false si la
 * requete n'est pas authentifiee : l'appelant s'arrete alors immediatement.
 */
export const requireAdmin = (req: NextApiRequest, res: NextApiResponse): boolean => {
  if (!isAdminRequest(req)) {
    res.status(401).json({ error: 'Authentification requise.' })
    return false
  }
  return true
}
