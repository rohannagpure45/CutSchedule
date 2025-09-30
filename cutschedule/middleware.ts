import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Allow the login page to be accessed
    if (pathname === '/admin/login') {
      // If user is already admin, redirect to dashboard
      if (token?.isAdmin === true) {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
      return NextResponse.next()
    }

    // For admin routes, check if user is admin
    if (pathname.startsWith('/admin')) {
      if (!token || !token.isAdmin) {
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