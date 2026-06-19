import { NextRequest, NextResponse } from 'next/server'

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

function applySecurityHeaders(res: NextResponse) {
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  applySecurityHeaders(response)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
