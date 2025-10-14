import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Validate ADMIN_EMAIL is set at startup to fail fast
if (!process.env.ADMIN_EMAIL) {
  throw new Error('ADMIN_EMAIL environment variable is not set. Please configure it to enable admin access.')
}

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname

    // With database sessions, JWT token in middleware may be null or lack fields.
    // Instead, rely on the presence of the NextAuth session cookie to determine auth state.
    const sessionToken =
      req.cookies.get('next-auth.session-token')?.value ||
      req.cookies.get('__Secure-next-auth.session-token')?.value

    const hasSession = Boolean(sessionToken)

    // Allow auth endpoints through untouched
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next()
    }

    // Allow the login page; if already authenticated, send to dashboard
    if (pathname === '/admin/login') {
      if (hasSession) {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
      return NextResponse.next()
    }

    // Protect admin routes by requiring a session cookie
    if (pathname.startsWith('/admin')) {
      if (!hasSession) {
        const url = new URL('/admin/login', req.url)
        url.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(url)
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Always allow to reach our custom logic above
      authorized: () => true,
    },
    pages: {
      signIn: '/admin/login',
      error: '/admin/login',
    },
    secret: process.env.NEXTAUTH_SECRET,
  }
)

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
}
