import type { GetServerSideProps } from 'next'
import { LOCAL_PRODUCTS } from '../src/data/localProducts'
import { isSupabaseConfigured } from '../src/lib/supabase'
import { listProducts } from '../src/services/products'
import type { Product } from '../src/types'
import { getSiteUrl, toAbsoluteUrl } from '../src/utils/site'

type SitemapEntry = {
  loc: string
  changefreq: 'daily' | 'weekly' | 'monthly'
  priority: number
  lastmod?: string
}

const STATIC_ROUTES: SitemapEntry[] = [
  { loc: toAbsoluteUrl('/'), changefreq: 'daily', priority: 1.0 },
  { loc: toAbsoluteUrl('/boutique'), changefreq: 'daily', priority: 0.95 },
  { loc: toAbsoluteUrl('/contact'), changefreq: 'weekly', priority: 0.8 },
  { loc: toAbsoluteUrl('/faq'), changefreq: 'weekly', priority: 0.7 },
  { loc: toAbsoluteUrl('/cgv-retours'), changefreq: 'monthly', priority: 0.5 },
  { loc: toAbsoluteUrl('/confidentialite'), changefreq: 'monthly', priority: 0.5 },
]

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const parseIsoDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString()
}

const resolveProducts = async (): Promise<Product[]> => {
  if (!isSupabaseConfigured) {
    return LOCAL_PRODUCTS
  }

  try {
    const products = await listProducts({ forceFresh: true })
    if (products.length) {
      return products
    }

    return LOCAL_PRODUCTS
  } catch {
    return LOCAL_PRODUCTS
  }
}

const buildProductEntries = async () => {
  const products = await resolveProducts()
  const bySlug = new Map<string, Product>()

  products.forEach((product) => {
    const current = bySlug.get(product.slug)
    if (!current) {
      bySlug.set(product.slug, product)
      return
    }

    if (new Date(product.updated_at).getTime() > new Date(current.updated_at).getTime()) {
      bySlug.set(product.slug, product)
    }
  })

  return Array.from(bySlug.values()).map<SitemapEntry>((product) => ({
    loc: toAbsoluteUrl(`/produit/${encodeURIComponent(product.slug)}`),
    changefreq: 'weekly',
    priority: 0.85,
    lastmod: parseIsoDate(product.updated_at) || parseIsoDate(product.created_at),
  }))
}

const buildSitemapXml = (entries: SitemapEntry[]) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    ${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const siteUrl = getSiteUrl()
  const staticEntries = STATIC_ROUTES.map((entry) => ({
    ...entry,
    loc: entry.loc.replace(/^https?:\/\/[^/]+/, siteUrl),
  }))
  const productEntries = await buildProductEntries()
  const allEntries = [...staticEntries, ...productEntries]

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.write(buildSitemapXml(allEntries))
  res.end()

  return { props: {} }
}

export default function SitemapXml() {
  return null
}
