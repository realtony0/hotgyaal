import { compressImageFile } from '../utils/image'

/*
 * Point d'entree unique pour l'envoi des visuels.
 *
 * On tente d'abord Cloudflare R2, via la route serveur qui detient les
 * identifiants. Tant que R2 n'est pas configure, cette route repond 501 et on
 * bascule sur le stockage Supabase : la boutique continue de fonctionner
 * pendant la mise en place.
 */

export type UploadFolder = 'products' | 'categories'

export class StorageNotConfiguredError extends Error {}

/**
 * Envoie le fichier vers R2 et renvoie son URL publique.
 * Leve StorageNotConfiguredError si R2 n'est pas branche, pour laisser
 * l'appelant choisir une solution de repli.
 */
export const uploadToR2 = async (file: File, folder: UploadFolder): Promise<string> => {
  const optimized = await compressImageFile(file)

  const response = await fetch(`/api/upload?folder=${folder}`, {
    method: 'POST',
    headers: { 'Content-Type': optimized.type || 'application/octet-stream' },
    body: optimized,
  })

  if (response.status === 501) {
    throw new StorageNotConfiguredError('Stockage R2 non configuré.')
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "L'envoi de l'image a échoué.")
  }

  const payload = (await response.json()) as { url?: string }
  if (!payload.url) {
    throw new Error("L'URL de l'image est absente de la réponse.")
  }

  return payload.url
}
