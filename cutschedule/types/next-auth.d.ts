import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isAdmin?: boolean
      adminId?: string
    }
  }

  // JWT interface for middleware token type compatibility
  // With database sessions, middleware still uses token structure
  interface JWT {
    email?: string | null
    sub?: string
  }
}