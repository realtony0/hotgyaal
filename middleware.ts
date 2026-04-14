import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Mettre le site en maintenance via variable d'environnement.
// Active quand NEXT_PUBLIC_MAINTENANCE_MODE === 'true'.
//
// Les routes /admin restent accessibles pour permettre la gestion
// du site pendant la maintenance.

const MAINTENANCE_FLAG = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'

// Cookie "bypass" pour permettre a l'equipe de consulter le site
// pendant la maintenance (valeur = NEXT_PUBLIC_ADMIN_ACCESS_CODE).
const BYPASS_COOKIE = 'hotgyaal_maint_bypass'
const BYPASS_VALUE = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE ?? ''

const ALWAYS_ALLOWED_PREFIXES = [
  '/maintenance',
  '/admin',
  '/api',
  '/_next',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
]

export function middleware(request: NextRequest) {
  if (!MAINTENANCE_FLAG) {
    return NextResponse.next()
  }

  const { pathname, searchParams } = request.nextUrl

  // Autoriser les chemins systeme et l'admin.
  if (ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Permettre l'activation du bypass via ?bypass=<code>
  if (BYPASS_VALUE && searchParams.get('bypass') === BYPASS_VALUE) {
    const response = NextResponse.next()
    response.cookies.set(BYPASS_COOKIE, BYPASS_VALUE, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    return response
  }

  // Si le cookie de bypass est present et valide, laisser passer.
  if (
    BYPASS_VALUE &&
    request.cookies.get(BYPASS_COOKIE)?.value === BYPASS_VALUE
  ) {
    return NextResponse.next()
  }

  // Rewrite (pas redirect) vers /maintenance : l'URL reste la meme
  // pour l'utilisateur et le statut 503 est conserve.
  const url = request.nextUrl.clone()
  url.pathname = '/maintenance'
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et les endpoints d'API Next.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
