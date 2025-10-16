import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }

  // User interface for database adapter
  interface User {
    id: string
    name?: string | null
    email?: string | null
    emailVerified?: Date | null
    image?: string | null
  }

  // JWT interface for middleware token type compatibility
  // With database sessions, middleware still uses token structure
  interface JWT {
    email?: string | null
    sub?: string
  }
}