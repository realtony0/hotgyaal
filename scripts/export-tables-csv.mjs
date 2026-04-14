// Export de chaque table Supabase en CSV vers ./backups/csv/
// Utile comme solution de secours si pg_dump ne passe pas.
//
// Prerequisites:
//   .env.local contient SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   node --env-file=.env.local scripts/export-tables-csv.mjs

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import path from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Erreur: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local')
  process.exit(1)
}

// Liste des tables a exporter. Ajuste selon ton schema.
const TABLES = [
  'products',
  'product_images',
  'product_variants',
  'categories',
  'orders',
  'order_items',
  'customers',
  'profiles',
]

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const OUTPUT_DIR = path.resolve('./backups/csv')
const PAGE_SIZE = 1000

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  let str
  if (typeof value === 'object') {
    str = JSON.stringify(value)
  } else {
    str = String(value)
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function exportTable(table) {
  let offset = 0
  let headerWritten = false
  const outputPath = path.join(OUTPUT_DIR, `${table}.csv`)
  let totalRows = 0
  let fileHandle

  try {
    fileHandle = await fs.open(outputPath, 'w')

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        console.error(`  [${table}] ${error.message}`)
        break
      }
      if (!data || data.length === 0) break

      if (!headerWritten) {
        const headers = Object.keys(data[0])
        await fileHandle.write(headers.join(',') + '\n')
        headerWritten = true
      }

      for (const row of data) {
        const line = Object.values(row).map(csvEscape).join(',')
        await fileHandle.write(line + '\n')
      }

      totalRows += data.length
      offset += PAGE_SIZE
      if (data.length < PAGE_SIZE) break
    }
  } finally {
    await fileHandle?.close()
  }

  return totalRows
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  console.log(`Export vers ${OUTPUT_DIR}`)
  console.log('')

  for (const table of TABLES) {
    process.stdout.write(`  ${table} ... `)
    try {
      const count = await exportTable(table)
      console.log(`${count} lignes`)
    } catch (err) {
      console.log(`ERREUR: ${err.message}`)
    }
  }

  console.log('')
  console.log('Export CSV termine.')
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
