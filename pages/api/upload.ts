import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'
import { R2_BUCKET, buildPublicUrl, getR2Client, isR2Configured } from '../../src/lib/r2'

/*
 * Reception des visuels envoyes depuis le back-office, puis depot sur R2.
 *
 * Le corps de la requete est le fichier brut : on desactive l'analyseur par
 * defaut de Next pour le lire tel quel, sans passer par du multipart.
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/avif',
])

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
}

const ALLOWED_FOLDERS = new Set(['products', 'categories'])

const readBody = (req: NextApiRequest) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_UPLOAD_BYTES) {
        reject(new Error('TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

const createKey = (folder: string, extension: string) => {
  const token =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `${folder}/${token}.${extension}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Méthode non autorisée.' })
  }

  // 501 signale au client que R2 n'est pas encore branche : il bascule alors
  // sur le stockage Supabase plutot que d'echouer.
  if (!isR2Configured) {
    return res.status(501).json({ error: 'Stockage R2 non configuré.' })
  }

  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim()
  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(415).json({ error: 'Format d’image non pris en charge.' })
  }

  const folderParam = Array.isArray(req.query.folder) ? req.query.folder[0] : req.query.folder
  const folder = ALLOWED_FOLDERS.has(String(folderParam)) ? String(folderParam) : 'products'

  // On refuse sur l'en-tete avant de lire quoi que ce soit : repondre en cours
  // de televersement ferait voir au client une connexion coupee plutot qu'une
  // erreur lisible.
  const declaredLength = Number(req.headers['content-length'] || 0)
  if (declaredLength > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: 'Image trop lourde (4 Mo maximum).' })
  }

  let body: Buffer
  try {
    body = await readBody(req)
  } catch (error) {
    if (error instanceof Error && error.message === 'TOO_LARGE') {
      return res.status(413).json({ error: 'Image trop lourde (4 Mo maximum).' })
    }
    return res.status(400).json({ error: 'Lecture du fichier impossible.' })
  }

  if (!body.length) {
    return res.status(400).json({ error: 'Fichier vide.' })
  }

  const key = createKey(folder, EXTENSION_BY_TYPE[contentType])

  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Les visuels produit ne changent pas une fois publies : on autorise
        // un cache long cote CDN et navigateur.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
  } catch (error) {
    console.error('[hotgyaal] envoi R2 impossible', error)
    return res.status(502).json({ error: "L'envoi de l'image a échoué." })
  }

  return res.status(201).json({ url: buildPublicUrl(key) })
}
