#!/usr/bin/env node
/*
 * Deplace les visuels produit de Supabase Storage vers Cloudflare R2.
 *
 * C'est le trafic des images qui avait epuise le quota d'egress de Supabase et
 * suspendu le projet. R2 ne facture pas la bande passante sortante : une fois
 * les images deplacees, afficher le catalogue ne peut plus couper le site.
 *
 * Pour chaque visuel encore heberge sur Supabase :
 *   telechargement -> redimensionnement WebP -> envoi sur R2 -> mise a jour de
 *   l'URL en base.
 *
 * Le script est relancable : les URLs deja servies par R2 sont ignorees, donc
 * une interruption se rattrape en le relancant.
 *
 *   node scripts/migrate-images-to-r2.mjs [--dry-run]
 *
 * Variables attendues (ou .env) :
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET, R2_PUBLIC_BASE_URL
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const MAX_DIMENSION = 2000
const WEBP_QUALITY = 90
const CONCURRENCY = 6
const PAGE_SIZE = 500

const dryRun = process.argv.includes('--dry-run')

// --limit N : ne traite que les N premiers visuels, pour verifier la chaine
// avant de lancer la migration complete.
const limitArg = process.argv.indexOf('--limit')
const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 0

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''
const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET
const publicBase = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '')

const missing = Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
  R2_ACCOUNT_ID: accountId,
  R2_ACCESS_KEY_ID: accessKeyId,
  R2_SECRET_ACCESS_KEY: secretAccessKey,
  R2_BUCKET: bucket,
  R2_PUBLIC_BASE_URL: publicBase,
})
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missing.length) {
  console.error(`Variables manquantes : ${missing.join(', ')}`)
  process.exit(1)
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
})

const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

const fetchProducts = async () => {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/products?select=id,image_url,gallery_urls`,
      { headers: { ...headers, Range: `${from}-${from + PAGE_SIZE - 1}` } },
    )
    if (!response.ok) throw new Error(`Lecture produits: HTTP ${response.status}`)
    const batch = await response.json()
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return rows
}

const needsMigration = (url) =>
  typeof url === 'string' && url.includes('/storage/v1/object/public/')

const migrateOne = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const original = Buffer.from(await response.arrayBuffer())
  const optimized = await sharp(original)
    .rotate() // applique l'orientation EXIF des photos telephone
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  // On conserve le nom de fichier d'origine, seule l'extension change :
  // le rapprochement reste lisible en cas de verification manuelle.
  const name = decodeURIComponent(url.split('/').pop() || '').replace(/\.[^.]+$/, '')
  const key = `products/${name}.webp`

  if (!dryRun) {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
  }

  return { url: `${publicBase}/${key}`, before: original.length, after: optimized.length }
}

const products = await fetchProducts()

const urls = new Set()
for (const product of products) {
  if (needsMigration(product.image_url)) urls.add(product.image_url)
  for (const url of product.gallery_urls || []) {
    if (needsMigration(url)) urls.add(url)
  }
}

console.log(
  `${products.length} produits, ${urls.size} visuels a deplacer` +
    (limit > 0 ? ` (limite a ${limit})` : '') +
    '.',
)
if (!urls.size) {
  console.log('Rien a faire : tout est deja sur R2.')
  process.exit(0)
}
if (dryRun) console.log('(simulation : aucun envoi, aucune ecriture en base)\n')

const mapping = new Map()
let done = 0
let failed = 0
let before = 0
let after = 0

const list = limit > 0 ? [...urls].slice(0, limit) : [...urls]
await Promise.all(
  Array.from({ length: CONCURRENCY }, (_, slot) =>
    (async () => {
      for (let i = slot; i < list.length; i += CONCURRENCY) {
        const url = list[i]
        try {
          const result = await migrateOne(url)
          mapping.set(url, result.url)
          before += result.before
          after += result.after
          done++
          if (done % 50 === 0) console.log(`  ${done}/${list.length}`)
        } catch (error) {
          failed++
          console.warn(`  echec ${url} : ${error.message}`)
        }
      }
    })(),
  ),
)

console.log(
  `\nVisuels traites : ${done} (echecs ${failed})` +
    `\nPoids : ${(before / 1048576).toFixed(0)} Mo -> ${(after / 1048576).toFixed(0)} Mo`,
)

if (dryRun) process.exit(0)

// Reecriture des URLs, produit par produit.
let updated = 0
for (const product of products) {
  const nextImage = mapping.get(product.image_url) ?? product.image_url
  const nextGallery = (product.gallery_urls || []).map((url) => mapping.get(url) ?? url)

  const imageChanged = nextImage !== product.image_url
  const galleryChanged =
    JSON.stringify(nextGallery) !== JSON.stringify(product.gallery_urls || [])

  if (!imageChanged && !galleryChanged) continue

  const response = await fetch(`${supabaseUrl}/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ image_url: nextImage, gallery_urls: nextGallery }),
  })

  if (!response.ok) {
    console.warn(`  base non mise a jour pour ${product.id} : HTTP ${response.status}`)
    continue
  }

  updated++
}

console.log(`Produits mis a jour en base : ${updated}`)
console.log('Verifiez la boutique, puis videz le bucket Supabase product-images.')
