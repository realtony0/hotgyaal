import sharp from 'sharp'
import {
  GARMENT_SAMPLE_HEIGHT,
  GARMENT_SAMPLE_WIDTH,
  pickGarmentColor,
} from '../utils/garmentColorCore'

/* Couleur de l'article sur une photo deja en ligne (serveur uniquement). */
export const extractGarmentColor = async (input: Buffer): Promise<string | null> => {
  const data = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(GARMENT_SAMPLE_WIDTH, GARMENT_SAMPLE_HEIGHT, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer()

  return pickGarmentColor(data)
}
