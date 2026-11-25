import sharp from 'sharp'
import { deltaE, rgbToLab, type Lab } from '../utils/colors'

/*
 * Couleur de l'article sur une photo produit (serveur uniquement).
 *
 * Une photo de mode, c'est un fond, parfois un mannequin, et l'article au
 * milieu. On reduit l'image a quelques milliers de pixels, on estime le fond
 * a partir du pourtour, on l'ecarte, puis on regroupe les pixels restants en
 * quelques couleurs en privilegiant le centre de l'image. Le groupe le plus
 * lourd donne la couleur de l'article.
 */

const WIDTH = 48
const HEIGHT = 64

type Pixel = {
  r: number
  g: number
  b: number
  x: number
  y: number
  lab: Lab
  weight: number
}

type Cluster = {
  lab: Lab
  hex: string
  weight: number
  count: number
}

/*
 * Tons chair : sur une photo portee (top court, legging taille basse), la peau
 * du mannequin peut peser plus que le vetement. On l'ecarte, sauf si cela
 * laisse trop peu de pixels : c'est alors l'article lui-meme qui est beige,
 * camel ou caramel.
 */
const isSkinTone = ([lightness, a, b]: Lab) => {
  const chroma = Math.hypot(a, b)
  const hue = (Math.atan2(b, a) * 180) / Math.PI
  return lightness > 20 && lightness < 80 && chroma > 10 && chroma < 42 && hue > 35 && hue < 75
}
const MIN_WEIGHT_WITHOUT_SKIN = 0.35

const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0')

const kmeans = (points: Pixel[], k: number, iterations: number): Cluster[] => {
  if (!points.length) {
    return []
  }

  let centers: Lab[] = Array.from(
    { length: Math.min(k, points.length) },
    (_, index) => points[Math.floor(((index + 0.5) * points.length) / k)].lab.slice() as Lab,
  )
  const assignment = new Array<number>(points.length).fill(0)

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    points.forEach((point, index) => {
      let best = 0
      let bestDistance = Infinity
      centers.forEach((center, centerIndex) => {
        const distance = deltaE(point.lab, center)
        if (distance < bestDistance) {
          bestDistance = distance
          best = centerIndex
        }
      })
      assignment[index] = best
    })

    const sums = centers.map(() => [0, 0, 0, 0])
    points.forEach((point, index) => {
      const sum = sums[assignment[index]]
      sum[0] += point.lab[0] * point.weight
      sum[1] += point.lab[1] * point.weight
      sum[2] += point.lab[2] * point.weight
      sum[3] += point.weight
    })
    centers = centers.map((center, index) =>
      sums[index][3]
        ? ([sums[index][0] / sums[index][3], sums[index][1] / sums[index][3], sums[index][2] / sums[index][3]] as Lab)
        : center,
    )
  }

  return centers
    .map((lab, index) => {
      let r = 0
      let g = 0
      let b = 0
      let weight = 0
      let count = 0
      points.forEach((point, pointIndex) => {
        if (assignment[pointIndex] !== index) return
        r += point.r * point.weight
        g += point.g * point.weight
        b += point.b * point.weight
        weight += point.weight
        count += 1
      })
      const hex = weight ? `#${toHex(r / weight)}${toHex(g / weight)}${toHex(b / weight)}` : '#000000'
      return { lab, hex, weight, count }
    })
    .filter((cluster) => cluster.count > 0)
}

export const extractGarmentColor = async (input: Buffer): Promise<string | null> => {
  const { data } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels: Pixel[] = []
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    const r = data[index * 3]
    const g = data[index * 3 + 1]
    const b = data[index * 3 + 2]
    pixels.push({
      r,
      g,
      b,
      x: index % WIDTH,
      y: Math.floor(index / WIDTH),
      lab: rgbToLab(r, g, b),
      weight: 1,
    })
  }

  // Le fond : les couleurs qui occupent une bonne part du pourtour.
  const border = pixels.filter(
    (pixel) => pixel.x < 2 || pixel.x >= WIDTH - 2 || pixel.y < 2 || pixel.y >= HEIGHT - 2,
  )
  const backgrounds = kmeans(border, 3, 8).filter((cluster) => cluster.count > border.length * 0.15)

  const centerX = WIDTH / 2
  const centerY = HEIGHT * 0.55
  const candidates = pixels
    .filter((pixel) => !backgrounds.some((cluster) => deltaE(cluster.lab, pixel.lab) < 12))
    .map((pixel) => {
      const dx = (pixel.x - centerX) / (WIDTH * 0.5)
      const dy = (pixel.y - centerY) / (HEIGHT * 0.55)
      return { ...pixel, weight: Math.exp(-(dx * dx + dy * dy) * 1.6) }
    })

  // Article indiscernible du fond : on ne devine pas.
  if (candidates.length < WIDTH * HEIGHT * 0.04) {
    return null
  }

  const withoutSkin = candidates.filter((pixel) => !isSkinTone(pixel.lab))
  const totalWeight = candidates.reduce((sum, pixel) => sum + pixel.weight, 0)
  const weightWithoutSkin = withoutSkin.reduce((sum, pixel) => sum + pixel.weight, 0)
  const pool = weightWithoutSkin >= totalWeight * MIN_WEIGHT_WITHOUT_SKIN ? withoutSkin : candidates

  const clusters = kmeans(pool, 5, 10).sort((a, b) => b.weight - a.weight)
  return clusters[0]?.hex ?? null
}
