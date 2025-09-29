import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // The withAuth function already handles the authentication check
    // This middleware will only run if the user is authenticated
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Check if user is trying to access admin routes
        if (req.nextUrl.pathname.startsWith('/admin')) {
          // Only allow access if user is authenticated and is admin
          return !!token?.isAdmin
        }

        // For API routes, check if user is authenticated
        if (req.nextUrl.pathname.startsWith('/api/admin')) {
          return !!token?.isAdmin
        }

        // Allow access to other routes
        return true
      },
    },
    pages: {
      signIn: '/admin/login',
    },
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*'
  ]
}