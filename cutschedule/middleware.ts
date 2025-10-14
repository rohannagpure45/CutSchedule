import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Validate ADMIN_EMAIL is set at startup to fail fast
if (!process.env.ADMIN_EMAIL) {
  throw new Error('ADMIN_EMAIL environment variable is not set. Please configure it to enable admin access.')
}

// Normalize admin email once at module load for performance
const ADMIN_EMAIL_NORMALIZED = process.env.ADMIN_EMAIL.toLowerCase().trim()

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // With database sessions, check if user email matches admin email
    // Use case-insensitive, trimmed comparison to handle edge cases
    const tokenEmail = token?.email?.toLowerCase().trim() ?? ''
    const isAdmin = tokenEmail === ADMIN_EMAIL_NORMALIZED && tokenEmail !== ''

    // Allow the login page to be accessed
    if (pathname === '/admin/login') {
      // If user is already admin, redirect to dashboard
      if (token && isAdmin) {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
      return NextResponse.next()
    }

    // For admin routes, check if user is admin
    if (pathname.startsWith('/admin')) {
      if (!token || !isAdmin) {
        const url = new URL('/admin/login', req.url)
        url.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(url)
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Allow all requests to pass to the middleware function
        // We'll handle the authorization logic there
        return true
      },
    },
    pages: {
      signIn: '/admin/login',
      error: '/admin/login',
    },
    secret: process.env.NEXTAUTH_SECRET,
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*'
  ]
}