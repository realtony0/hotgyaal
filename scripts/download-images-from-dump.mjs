// Extrait toutes les URLs d'images Supabase Storage d'un dump SQL
// (ou de fichiers CSV) et les telecharge localement dans ./backups/storage-from-dump/
//
// Utilise le CDN public Supabase, qui peut continuer a repondre meme
// quand l'API est restreinte (exceed_cached_egress_quota).
//
// Usage:
//   node scripts/download-images-from-dump.mjs <path-to-dump.sql>
//   node scripts/download-images-from-dump.mjs backups/hotgyaal_full_*.sql
//
// Optionnel:
//   CONCURRENCY=8 node scripts/download-images-from-dump.mjs ...

import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const inputs = process.argv.slice(2)
if (inputs.length === 0) {
  console.error('Usage: node scripts/download-images-from-dump.mjs <dump.sql> [more files...]')
  process.exit(1)
}

const OUTPUT_DIR = path.resolve('./backups/storage-from-dump')
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6)

// Match les URLs Supabase Storage, publiques ou signees.
const URL_REGEX =
  /https?:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/(?:public|sign|authenticated)\/[^\s'"\\);,]+/gi

async function extractUrls(files) {
  const urls = new Set()
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8')
    const matches = content.match(URL_REGEX)
    if (matches) {
      for (const raw of matches) {
        // Nettoie les echappements SQL (\\, '', etc.)
        const clean = raw.replace(/\\+$/, '').replace(/''+$/, '')
        urls.add(clean)
      }
    }
  }
  return Array.from(urls)
}

function localPathFor(url) {
  // /storage/v1/object/public/<bucket>/<path...>
  const u = new URL(url)
  const parts = u.pathname.split('/').filter(Boolean)
  // ['storage', 'v1', 'object', 'public', bucket, ...rest]
  const idx = parts.indexOf('object')
  const relevant = parts.slice(idx + 2) // skip "object" and "public|sign|authenticated"
  const decoded = relevant.map((p) => decodeURIComponent(p))
  return path.join(OUTPUT_DIR, ...decoded)
}

async function downloadOne(url) {
  const dest = localPathFor(url)
  try {
    const stat = await fs.stat(dest).catch(() => null)
    if (stat && stat.size > 0) {
      return { url, dest, skipped: true }
    }
    const res = await fetch(url)
    if (!res.ok) {
      return { url, dest, error: `HTTP ${res.status}` }
    }
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await pipeline(Readable.fromWeb(res.body), (await fs.open(dest, 'w')).createWriteStream())
    const finalSize = (await fs.stat(dest)).size
    return { url, dest, size: finalSize }
  } catch (err) {
    return { url, dest, error: err.message }
  }
}

async function runPool(items, limit, worker) {
  const results = []
  let i = 0
  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++
      const r = await worker(items[idx], idx)
      results[idx] = r
    }
  })
  await Promise.all(runners)
  return results
}

async function main() {
  const urls = await extractUrls(inputs)
  if (urls.length === 0) {
    console.log('Aucune URL Supabase Storage trouvee dans les fichiers fournis.')
    return
  }

  console.log(`URLs trouvees : ${urls.length}`)
  console.log(`Destination   : ${OUTPUT_DIR}`)
  console.log(`Concurrency   : ${CONCURRENCY}`)
  console.log('')

  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  let done = 0
  const results = await runPool(urls, CONCURRENCY, async (url) => {
    const r = await downloadOne(url)
    done += 1
    const status = r.error ? `✗ ${r.error}` : r.skipped ? 'deja present' : `✓ ${r.size} bytes`
    console.log(`[${done}/${urls.length}] ${status}  ${url}`)
    return r
  })

  const ok = results.filter((r) => r && !r.error).length
  const skipped = results.filter((r) => r && r.skipped).length
  const failed = results.filter((r) => r && r.error).length

  console.log('')
  console.log('Resume:')
  console.log(`  Telecharges : ${ok - skipped}`)
  console.log(`  Deja presents : ${skipped}`)
  console.log(`  Echecs : ${failed}`)

  if (failed > 0) {
    console.log('')
    console.log('URLs en echec (tu peux relancer le script, il reprendra la ou il s\'est arrete):')
    for (const r of results) {
      if (r?.error) console.log(`  ${r.error}  ${r.url}`)
    }
  }
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
