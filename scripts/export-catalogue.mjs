#!/usr/bin/env node
/*
 * Sauvegarde du catalogue depuis Supabase vers des fichiers JSON.
 *
 * A lancer regulierement : c'est le filet de securite si le projet Supabase
 * redevient indisponible (quota, pause, incident). Seules les donnees du
 * catalogue sont exportees ; les commandes, qui contiennent des donnees
 * personnelles clientes, sont volontairement laissees de cote.
 *
 *   node scripts/export-catalogue.mjs [dossier-de-sortie]
 *
 * Variables attendues (ou .env) :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */

import fs from 'node:fs'
import path from 'node:path'

const TABLES = ['products', 'store_categories', 'store_settings']
const PAGE_SIZE = 500

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  )
  process.exit(1)
}

const outDir = process.argv[2] || 'backup'
fs.mkdirSync(outDir, { recursive: true })

const fetchTable = async (table) => {
  const rows = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
      headers: { apikey: supabaseKey, Range: `${from}-${from + PAGE_SIZE - 1}` },
    })

    if (!response.ok) {
      throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`)
    }

    const batch = await response.json()
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  return rows
}

const stamp = new Date().toISOString().slice(0, 10)
const products = []

for (const table of TABLES) {
  const rows = await fetchTable(table)
  if (table === 'products') products.push(...rows)
  const file = path.join(outDir, `${table}-${stamp}.json`)
  fs.writeFileSync(file, JSON.stringify(rows, null, 2))
  console.log(`${table.padEnd(18)} ${String(rows.length).padStart(5)} lignes -> ${file}`)
}

// Inventaire des visuels references, utile pour la reprise des images.
const images = new Set()
for (const product of products) {
  if (product.image_url) images.add(product.image_url)
  for (const url of product.gallery_urls || []) {
    if (url) images.add(url)
  }
}

const imageList = path.join(outDir, `images-${stamp}.txt`)
fs.writeFileSync(imageList, [...images].join('\n'))
console.log(`${'images distinctes'.padEnd(18)} ${String(images.size).padStart(5)}       -> ${imageList}`)
