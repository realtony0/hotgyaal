/*
 * Optimisation des photos avant envoi.
 *
 * Les visuels arrivent en general depuis un telephone : 3 a 8 Mo, plusieurs
 * milliers de pixels de large. On les ramene a une taille raisonnable avant
 * l'envoi, sans chercher a compresser au maximum : le stockage R2 ne facture
 * pas la bande passante, la qualite prime donc sur le poids. L'objectif est
 * seulement d'eviter les fichiers demesures et de garder la boutique fluide
 * sur mobile.
 */

const MAX_DIMENSION = 2000
const WEBP_QUALITY = 0.9

const canUseCanvas = () =>
  typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined'

const loadBitmap = async (file: File) => {
  // `imageOrientation` applique la rotation EXIF : sans cela, les photos
  // portrait prises au telephone ressortent couchees.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // certains navigateurs refusent l'option : on retombe sur <img>
    }
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Image illisible."))
    }
    image.src = url
  })
}

const getDimensions = (source: ImageBitmap | HTMLImageElement) => {
  const width = 'width' in source ? source.width : 0
  const height = 'height' in source ? source.height : 0
  return { width, height }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })

const replaceExtension = (name: string, extension: string) => {
  const base = name.replace(/\.[^./\\]+$/, '') || 'image'
  return `${base}.${extension}`
}

/**
 * Renvoie une version WebP redimensionnee du fichier.
 * En cas d'echec (format exotique, navigateur ancien, resultat plus lourd que
 * l'original), le fichier d'origine est renvoye tel quel : l'envoi ne doit
 * jamais echouer a cause de l'optimisation.
 */
export const compressImageFile = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  if (!canUseCanvas()) {
    return file
  }

  try {
    const source = await loadBitmap(file)
    const { width, height } = getDimensions(source)

    if (!width || !height) {
      return file
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const context = canvas.getContext('2d')
    if (!context) {
      return file
    }

    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    if ('close' in source && typeof source.close === 'function') {
      source.close()
    }

    const blob = await toBlob(canvas, 'image/webp', WEBP_QUALITY)
    if (!blob || blob.size >= file.size) {
      return file
    }

    return new File([blob], replaceExtension(file.name, 'webp'), {
      type: 'image/webp',
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}
