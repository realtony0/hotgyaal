// Backup de tous les buckets Supabase Storage vers ./backups/storage/
//
// Prerequisites:
//   npm install  (pour @supabase/supabase-js deja present)
//   .env.local contient SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   node --env-file=.env.local scripts/backup-storage.mjs
//
// Note: Ce script necessite que le service Supabase soit accessible.
// Si "Services restricted" est affiche, il faut d'abord resoudre le billing.

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import path from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Erreur: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const OUTPUT_ROOT = path.resolve('./backups/storage')

async function downloadFolder(bucket, prefix = '') {
  const { data: entries, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

  if (error) {
    console.error(`  [${bucket}/${prefix}] Echec list:`, error.message)
    return { downloaded: 0, failed: 1 }
  }

  let downloaded = 0
  let failed = 0

  for (const entry of entries) {
    const remotePath = prefix ? `${prefix}/${entry.name}` : entry.name

    // Dossier (pas de metadata)
    if (!entry.metadata) {
      const res = await downloadFolder(bucket, remotePath)
      downloaded += res.downloaded
      failed += res.failed
      continue
    }

    const { data: blob, error: dlError } = await supabase.storage
      .from(bucket)
      .download(remotePath)

    if (dlError || !blob) {
      console.error(`  ✗ ${bucket}/${remotePath}:`, dlError?.message ?? 'no data')
      failed += 1
      continue
    }

    const localPath = path.join(OUTPUT_ROOT, bucket, remotePath)
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    const buffer = Buffer.from(await blob.arrayBuffer())
    await fs.writeFile(localPath, buffer)
    console.log(`  ✓ ${bucket}/${remotePath} (${buffer.byteLength} bytes)`)
    downloaded += 1
  }

  return { downloaded, failed }
}

async function main() {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true })

  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) {
    console.error('Impossible de lister les buckets:', error.message)
    console.error('Si le message mentionne "exceed_cached_egress_quota", il faut resoudre le billing avant.')
    process.exit(1)
  }

  if (!buckets.length) {
    console.log('Aucun bucket trouve.')
    return
  }

  console.log(`Buckets: ${buckets.map((b) => b.name).join(', ')}`)
  console.log('')

  let totalDownloaded = 0
  let totalFailed = 0

  for (const bucket of buckets) {
    console.log(`Bucket: ${bucket.name}`)
    const res = await downloadFolder(bucket.name)
    totalDownloaded += res.downloaded
    totalFailed += res.failed
    console.log(`  => ${res.downloaded} telecharges, ${res.failed} echecs`)
    console.log('')
  }

  console.log('Backup Storage termine.')
  console.log(`  Total telecharges : ${totalDownloaded}`)
  console.log(`  Total echecs      : ${totalFailed}`)
  console.log(`  Dossier de sortie : ${OUTPUT_ROOT}`)
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
