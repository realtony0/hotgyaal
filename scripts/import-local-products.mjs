import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const publicDir = path.join(rootDir, 'public', 'products')

const IMAGE_REGEX = /\.(jpe?g|png)$/i

const stripExtension = (fileName) => fileName.replace(/\.[^.]+$/, '')

const stripTrailingNumber = (value) =>
  value.replace(/\s*[-_]?\d+\s*$/, '').trim()

const normalizeKey = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?:\s|-)*\d+$/, '')
    .trim()

const toTitleCase = (value) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const toSlug = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const escapeSql = (value) => value.replace(/'/g, "''")

const categorize = (name) => {
  const lower = name.toLowerCase()

  if (/(yoga|sport|training|jogging|set)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Tenues de sport' }
  }

  if (/(short)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Shorts' }
  }

  if (/(pantalon|pant|jean)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Pantalons' }
  }

  if (/(jupe)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Jupes' }
  }

  if (/(pull|sweat|hoodie|cardigan)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Pulls' }
  }

  if (/(veste|jacket|blazer)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Vestes' }
  }

  if (/(t-shirt|tee|tshirt)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'T-shirts' }
  }

  if (/(top)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Tops' }
  }

  if (/(robe|dress)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Robes' }
  }

  if (/(jumpsuit|combinaison)/.test(lower)) {
    return { main: 'Vêtements Femmes', sub: 'Pantalons' }
  }

  return { main: 'Vêtements Femmes', sub: 'Robes' }
}

const defaultPrice = 25000
const defaultStock = 20

fs.mkdirSync(publicDir, { recursive: true })

const rootFiles = fs.readdirSync(rootDir)
const images = rootFiles.filter((file) => IMAGE_REGEX.test(file))

const groups = new Map()

for (const file of images) {
  const baseName = stripExtension(file).trim()
  const cleanBase = stripTrailingNumber(baseName)
  const key = normalizeKey(cleanBase || baseName)

  if (!key) {
    continue
  }

  const entry = groups.get(key) ?? {
    key,
    displayName: null,
    files: [],
  }

  if (!entry.displayName && baseName === cleanBase) {
    entry.displayName = cleanBase
  }

  entry.files.push({
    file,
    baseName,
    cleanBase,
  })

  groups.set(key, entry)
}

const usedSlugs = new Set()
const products = []

for (const entry of groups.values()) {
  entry.files.sort((a, b) => a.file.localeCompare(b.file))

  const baseDisplay = entry.displayName ?? toTitleCase(entry.cleanBase || entry.key)
  let slug = toSlug(baseDisplay)

  if (!slug) {
    slug = toSlug(entry.key)
  }

  let uniqueSlug = slug
  let index = 2
  while (usedSlugs.has(uniqueSlug)) {
    uniqueSlug = `${slug}-${index}`
    index += 1
  }
  usedSlugs.add(uniqueSlug)

  const imagesForProduct = entry.files.map((item, idx) => {
    const extension = path.extname(item.file).toLowerCase() || '.jpeg'
    const targetName = `${uniqueSlug}-${String(idx + 1).padStart(2, '0')}${extension}`
    const targetPath = path.join(publicDir, targetName)

    fs.copyFileSync(path.join(rootDir, item.file), targetPath)

    return `/products/${targetName}`
  })

  const mainImage = imagesForProduct[0] ?? null
  const gallery = imagesForProduct.slice(1)

  const category = categorize(baseDisplay)

  products.push({
    name: baseDisplay,
    slug: uniqueSlug,
    description:
      "Pièce premium HOTGYAAL. Coupe élégante, finitions soignées et allure chic.",
    price: defaultPrice,
    compare_price: null,
    stock: defaultStock,
    main_category: category.main,
    sub_category: category.sub,
    image_url: mainImage,
    gallery_urls: gallery,
    is_new: false,
    is_best_seller: false,
  })
}

products.sort((a, b) => a.name.localeCompare(b.name))

const rows = products.map((product) => {
  const galleryArray = product.gallery_urls.length
    ? `array[${product.gallery_urls
        .map((url) => `'${escapeSql(url)}'`)
        .join(', ')}]`
    : "array[]::text[]"

  return `  (\n    '${escapeSql(product.name)}',\n    '${escapeSql(product.slug)}',\n    '${escapeSql(product.description)}',\n    ${product.price},\n    ${product.compare_price ?? 'null'},\n    ${product.stock},\n    '${escapeSql(product.main_category)}',\n    '${escapeSql(product.sub_category)}',\n    ${product.image_url ? `'${escapeSql(product.image_url)}'` : 'null'},\n    ${galleryArray},\n    ${product.is_new},\n    ${product.is_best_seller}\n  )`
})

const seedSql = `insert into public.products (\n  name,\n  slug,\n  description,\n  price,\n  compare_price,\n  stock,\n  main_category,\n  sub_category,\n  image_url,\n  gallery_urls,\n  is_new,\n  is_best_seller\n)\nvalues\n${rows.join(',\n')}\non conflict (slug) do nothing;\n`

fs.writeFileSync(path.join(rootDir, 'supabase', 'seed.sql'), seedSql)

console.log(`Imported ${products.length} products.`)
