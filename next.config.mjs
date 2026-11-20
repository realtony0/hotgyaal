/** @type {import('next').NextConfig} */

/*
 * En-tetes de securite appliques a toutes les reponses.
 *
 * La CSP est volontairement stricte mais couvre les origines reellement
 * utilisees : images sur R2, API Supabase, polices Google. 'unsafe-inline' sur
 * les styles reste necessaire pour les styles en ligne de Next ; les scripts,
 * eux, n'ont pas besoin d'inline.
 */
const SUPABASE_HOST = 'https://*.supabase.co'
const R2_HOST = 'https://*.r2.dev'

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: ${R2_HOST} ${SUPABASE_HOST}`,
  // 'unsafe-inline' requis par les scripts d'hydratation de Next (Pages
  // Router). Le pentest n'a trouve aucune injection de script ; durcir en
  // nonce est un chantier a part.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `connect-src 'self' ${SUPABASE_HOST} ${R2_HOST}`,
  "frame-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
