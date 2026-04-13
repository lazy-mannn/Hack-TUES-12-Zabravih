import { NextRequest, NextResponse } from 'next/server'

const DJANGO_URL = process.env.DJANGO_URL!

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/verify-email',
  '/auth/reset-password',
  '/auth/callback',
  '/auth/provider-signup',
  // PWA / SEO files
  '/manifest.json',
  '/robots.txt',
  '/sw.js',
  '/icon',
  '/apple-icon',
  '/icons',
]

const STATIC_EXT = /\.(svg|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|otf|css|js|json|txt|map)$/i

function isPublic(pathname: string) {
  if (STATIC_EXT.test(pathname)) return true
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  // Forward the Django session cookie to verify auth status
  const cookieHeader = request.headers.get('cookie') ?? ''

  try {
    const res = await fetch(`${DJANGO_URL}/_allauth/browser/v1/auth/session`, {
      headers: { cookie: cookieHeader },
    })
    const data = await res.json()

    if (data?.data?.user && data.status === 200) {
      return NextResponse.next()
    }
  } catch {
    // Django unreachable — fail open to avoid locking out users during downtime
    return NextResponse.next()
  }

  const loginUrl = new URL('/auth/login', request.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static files.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
