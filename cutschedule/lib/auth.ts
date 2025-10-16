import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error(
    'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
  )
}

function sanitizeAccountObject(account: any): void {
  try {
    if ('refresh_token_expires_in' in account) {
      delete (account as any).refresh_token_expires_in
      console.log('Removed refresh_token_expires_in from account object')
    }

    const validAccountFields = [
      'provider', 'type', 'providerAccountId', 'access_token',
      'expires_at', 'refresh_token', 'scope', 'token_type',
      'id_token', 'session_state', 'userId'
    ]

    const accountKeys = Object.keys(account)
    const invalidFields = accountKeys.filter(key => !validAccountFields.includes(key))
    if (invalidFields.length > 0) {
      console.log('Found invalid fields in account object:', invalidFields)
      invalidFields.forEach(field => {
        delete (account as any)[field]
        console.log(`Removed ${field} from account object`)
      })
    }
  } catch (e) {
    console.warn('Failed to sanitize account object:', e)
  }
}

// Customize the Prisma adapter to handle missing sessions gracefully during deletion
const customAdapter = {
  ...PrismaAdapter(prisma),
  deleteSession: async (sessionToken: string) => {
    try {
      return await prisma.session.delete({
        where: { sessionToken },
      })
    } catch (error: any) {
      // Ignore P2025 error (record not found) - session already deleted or expired
      if (error.code === 'P2025') {
        console.log('[next-auth][info] Session already deleted or expired:', sessionToken)
        return null
      }
      throw error
    }
  },
}

export const authOptions: NextAuthOptions = {
  adapter: customAdapter as any,
  providers: [
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log('Sign in attempt:', { user: user.email, account: account?.provider })

      // Sanitize account object to avoid PrismaAdapter issues with unexpected fields
      if (account) sanitizeAccountObject(account)

      // OAuth allowed test users provide access control - no admin table needed
      return true
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      if (url === baseUrl || url === '/') return `${baseUrl}/admin`
      return baseUrl + '/admin'
    },
    async session({ session, user }) {
      if (user && session.user) {
        session.user.id = user.id
        // No admin privileges - OAuth allowed test users provide access control
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Session callback:', {
          email: session.user?.email,
          userId: user?.id,
        })
      }

      return session
    },
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
    signOut: '/admin/login',
  },
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
