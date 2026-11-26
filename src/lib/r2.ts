import { S3Client } from '@aws-sdk/client-s3'

/*
 * Stockage des visuels sur Cloudflare R2.
 *
 * R2 ne facture pas la bande passante sortante, contrairement au stockage
 * Supabase dont le quota d'egress avait fini par suspendre le projet. Les
 * images vivent donc ici, la base ne garde que leur URL.
 *
 * Ces identifiants ne portent pas le prefixe NEXT_PUBLIC : ils restent
 * cote serveur et ne sont jamais exposes au navigateur.
 */

const accountId = process.env.R2_ACCOUNT_ID?.trim()
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()

export const R2_BUCKET = process.env.R2_BUCKET?.trim() || ''

/**
 * Domaine public servant les fichiers, sans slash final.
 * Typiquement un sous-domaine rattache au bucket (https://img.hotgyaal.com).
 */
export const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL?.trim() || '').replace(
  /\/+$/,
  '',
)

export const isR2Configured = Boolean(
  accountId && accessKeyId && secretAccessKey && R2_BUCKET && R2_PUBLIC_BASE_URL,
)

let client: S3Client | null = null

export const getR2Client = (): S3Client => {
  if (!isR2Configured) {
    throw new Error('Stockage R2 non configuré.')
  }

  if (!client) {
    client = new S3Client({
      // R2 expose une API compatible S3 sur un point d'acces unique.
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
      },
    })
  }

  return client
}

export const buildPublicUrl = (key: string) => `${R2_PUBLIC_BASE_URL}/${key}`
