#!/usr/bin/env node
/*
 * Transforme une sauvegarde JSON (voir export-catalogue.mjs) en fichier SQL
 * importable dans un autre projet Supabase.
 *
 * Le SQL produit est reexecutable : chaque ligne est inseree avec un
 * `on conflict (id) do update`, donc relancer l'import met a jour plutot que
 * de dupliquer. Le tout est enveloppe dans une transaction : en cas d'erreur,
 * rien n'est ecrit.
 *
 *   node scripts/build-import-sql.mjs backup/products-2026-08-28.json > import.sql
 *   node scripts/build-import-sql.mjs backup/ > import.sql   # les trois tables
 *
 * Puis :
 *   psql "$DATABASE_URL" -f import.sql
 */

import fs from 'node:fs'
import path from 'node:path'

const TABLE_BY_PREFIX = {
  products: 'public.products',
  store_categories: 'public.store_categories',
  store_settings: 'public.store_settings',
}

// Colonnes de type text[] : elles s'ecrivent en litteral tableau Postgres.
const ARRAY_COLUMNS = new Set(['gallery_urls', 'sizes', 'subcategories'])

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`

const toArrayLiteral = (values) => {
  if (!Array.isArray(values) || !values.length) return "'{}'"
  const items = values.map((item) => `"${String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
  return quote(`{${items.join(',')}}`)
}

const toSqlValue = (column, value) => {
  if (ARRAY_COLUMNS.has(column)) return toArrayLiteral(value)
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return `${quote(JSON.stringify(value))}::jsonb`
  return quote(value)
}

const buildStatements = (table, rows) => {
  if (!rows.length) return []

  const columns = Object.keys(rows[0])
  const updatable = columns.filter((column) => column !== 'id')
  const statements = []

  for (const row of rows) {
    const values = columns.map((column) => toSqlValue(column, row[column]))
    const updates = updatable.map((column) => `${column} = excluded.${column}`)

    statements.push(
      `insert into ${table} (${columns.join(', ')})\n` +
        `values (${values.join(', ')})\n` +
        `on conflict (id) do update set ${updates.join(', ')};`,
    )
  }

  return statements
}

const target = process.argv[2]
if (!target) {
  console.error('Usage: node scripts/build-import-sql.mjs <fichier.json | dossier>')
  process.exit(1)
}

const files = fs.statSync(target).isDirectory()
  ? fs
      .readdirSync(target)
      .filter((name) => name.endsWith('.json'))
      .map((name) => path.join(target, name))
  : [target]

// Les categories passent avant les produits : les fiches y font reference.
const order = ['store_categories', 'store_settings', 'products']
const sorted = files.sort((a, b) => {
  const rank = (file) =>
    order.findIndex((prefix) => path.basename(file).startsWith(prefix))
  return rank(a) - rank(b)
})

const out = ['-- Import du catalogue HOTGYAAL', 'begin;', '']
let total = 0

for (const file of sorted) {
  const prefix = order.find((name) => path.basename(file).startsWith(name))
  if (!prefix) {
    console.error(`Ignore (table inconnue) : ${file}`)
    continue
  }

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  const statements = buildStatements(TABLE_BY_PREFIX[prefix], rows)
  out.push(`-- ${TABLE_BY_PREFIX[prefix]} : ${rows.length} lignes`, ...statements, '')
  total += rows.length
  console.error(`${prefix.padEnd(18)} ${String(rows.length).padStart(5)} lignes`)
}

out.push('commit;')
process.stdout.write(out.join('\n'))
console.error(`\nTotal : ${total} lignes.`)
