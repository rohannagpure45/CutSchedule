import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    console.log('Middleware check:', {
      pathname,
      hasToken: !!token,
      isAdmin: token?.isAdmin,
      email: token?.email
    })

    // Allow the login page to be accessed
    if (pathname === '/admin/login') {
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