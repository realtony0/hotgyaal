#!/usr/bin/env node
/*
 * Importe une sauvegarde JSON dans un projet Supabase, via l'API REST.
 *
 * Utile pour repartir sur un nouveau projet : on recree d'abord le schema
 * (supabase/full_setup.sql, a executer dans le SQL Editor), puis on rejoue le
 * catalogue avec ce script.
 *
 * L'import est en upsert sur l'identifiant : le relancer met a jour les lignes
 * existantes au lieu d'en creer des doubles, donc une interruption se rattrape
 * simplement en relancant.
 *
 *   node scripts/import-catalogue.mjs backup/
 *   node scripts/import-catalogue.mjs backup/ --dry-run
 *
 * Variables attendues : celles du projet CIBLE.
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */

import fs from 'node:fs'
import path from 'node:path'

const BATCH_SIZE = 100

// Les categories et les reglages passent avant les produits.
const IMPORT_ORDER = ['store_categories', 'store_settings', 'products']

const dryRun = process.argv.includes('--dry-run')
const source = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--'))

if (!source) {
  console.error('Usage: node scripts/import-catalogue.mjs <dossier-de-sauvegarde> [--dry-run]')
  process.exit(1)
}

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY du projet cible.',
  )
  process.exit(1)
}

console.log(`Cible : ${supabaseUrl}`)
if (dryRun) console.log('(simulation : aucune ecriture)\n')

const files = fs.readdirSync(source).filter((name) => name.endsWith('.json'))

const findFile = (table) => {
  const match = files.find((name) => name.startsWith(table))
  return match ? path.join(source, match) : null
}

const pushBatch = async (table, rows) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      // upsert : on met a jour la ligne si l'identifiant existe deja
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${await response.text()}`)
  }
}

let failures = 0

for (const table of IMPORT_ORDER) {
  const file = findFile(table)
  if (!file) {
    console.log(`${table.padEnd(18)} aucun fichier, ignore`)
    continue
  }

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!rows.length) {
    console.log(`${table.padEnd(18)} vide, ignore`)
    continue
  }

  let done = 0

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE)

    if (dryRun) {
      done += batch.length
      continue
    }

    try {
      await pushBatch(table, batch)
      done += batch.length
    } catch (error) {
      failures++
      console.error(`  ${table} lignes ${start}-${start + batch.length - 1} : ${error.message}`)
    }
  }

  console.log(`${table.padEnd(18)} ${String(done).padStart(5)} / ${rows.length} lignes`)
}

if (failures) {
  console.error(`\n${failures} lot(s) en echec. Relancez le script : l'import est en upsert.`)
  process.exit(1)
}

console.log('\nImport termine.')
