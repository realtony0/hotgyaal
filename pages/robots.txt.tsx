import type { GetServerSideProps } from 'next'
import { getSiteUrl } from '../src/utils/site'

const buildRobotsTxt = () => {
  const siteUrl = getSiteUrl()
  const host = siteUrl.replace(/^https?:\/\//, '')

  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /panier
Disallow: /compte

Sitemap: ${siteUrl}/sitemap.xml
Host: ${host}
`
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.write(buildRobotsTxt())
  res.end()

  return { props: {} }
}

export default function RobotsTxt() {
  return null
}
