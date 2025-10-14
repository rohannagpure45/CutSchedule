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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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

      const adminEmail = process.env.ADMIN_EMAIL
      if (!adminEmail || adminEmail.trim() === '') {
        console.error('ADMIN_EMAIL environment variable is not configured')
        return false
      }
      if (!user.email || user.email !== adminEmail) {
        console.log('Unauthorized sign in attempt:', user.email)
        return false
      }

      // Sanitize account object to avoid PrismaAdapter issues with unexpected fields
      if (account) sanitizeAccountObject(account)

      if (account?.provider === 'google' && user.email) {
        const userEmail = user.email
        const userName = user.name || 'Admin User'
        try {
          // Ensure Admin record exists; avoid unnecessary upserts
          const existingAdmin = await prisma.admin.findUnique({ where: { email: userEmail } })
          if (!existingAdmin) {
            const created = await prisma.admin.create({
              data: {
                email: userEmail,
                googleId: account.providerAccountId,
                name: userName,
              },
            })
            console.log('Admin record created for:', userEmail, 'with ID:', created.id)
          } else if (
            existingAdmin.googleId !== account.providerAccountId ||
            existingAdmin.name !== userName
          ) {
            await prisma.admin.update({
              where: { email: userEmail },
              data: {
                googleId: account.providerAccountId,
                name: userName,
              },
            })
            console.log('Admin record updated for:', userEmail)
          }
        } catch (error) {
          console.error('Failed to ensure admin record:', error)
          return false
        }
      }

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
        session.user.isAdmin = user.email ? user.email === process.env.ADMIN_EMAIL : false

        // Ensure User is linked to Admin once the User record exists
        if (!session.user.adminId) {
          try {
            const admin = user.email
              ? await prisma.admin.findUnique({ where: { email: user.email } })
              : null
            if (admin) {
              await prisma.user.update({
                where: { id: user.id },
                data: { adminId: admin.id },
              })
              session.user.adminId = admin.id
              console.log('Linked User to Admin in session callback')
            } else {
              session.user.adminId = user.adminId ?? undefined
            }
          } catch (error) {
            console.error('Failed to link User to Admin in session:', error)
            session.user.adminId = user.adminId ?? undefined
          }
        } else {
          session.user.adminId = user.adminId ?? undefined
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Session callback:', {
          email: session.user?.email,
          isAdmin: session.user?.isAdmin,
          userId: user?.id,
          adminId: session.user?.adminId,
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
