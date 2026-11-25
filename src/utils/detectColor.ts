import {
  GARMENT_SAMPLE_HEIGHT,
  GARMENT_SAMPLE_WIDTH,
  pickGarmentColor,
} from './garmentColorCore'

/*
 * Teinte d'une photo choisie dans l'administration, avant meme son envoi.
 *
 * Meme calcul que sur le serveur : l'image est reduite a quelques milliers de
 * pixels (recadree comme une vignette), puis analysee. Le fichier est local,
 * donc lisible par le canvas sans restriction d'origine.
 */
export const detectColorFromFile = async (file: File): Promise<string | null> => {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return null
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const width = GARMENT_SAMPLE_WIDTH
    const height = GARMENT_SAMPLE_HEIGHT

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      bitmap.close()
      return null
    }

    // Recadrage "cover", comme sur le serveur.
    const scale = Math.max(width / bitmap.width, height / bitmap.height)
    const sourceWidth = width / scale
    const sourceHeight = height / scale
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      bitmap,
      (bitmap.width - sourceWidth) / 2,
      (bitmap.height - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    )
    bitmap.close()

    const rgba = context.getImageData(0, 0, width, height).data
    const rgb = new Uint8Array(width * height * 3)
    for (let index = 0; index < width * height; index += 1) {
      rgb[index * 3] = rgba[index * 4]
      rgb[index * 3 + 1] = rgba[index * 4 + 1]
      rgb[index * 3 + 2] = rgba[index * 4 + 2]
    }

    return pickGarmentColor(rgb)
  } catch {
    return null
  }
}
