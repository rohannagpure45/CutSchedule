import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('Sign in attempt:', { user: user.email, account: account?.provider })

      // Only allow admin email to sign in
      if (user.email !== process.env.ADMIN_EMAIL) {
        console.log('Unauthorized sign in attempt:', user.email)
        return false
      }

      // Remove fields that Prisma doesn't recognize from Google OAuth response
      // Google returns 'refresh_token_expires_in' which breaks PrismaAdapter
      if (account && 'refresh_token_expires_in' in account) {
        delete (account as any).refresh_token_expires_in
        console.log('Removed refresh_token_expires_in from account object')
      }

      // Update admin record only - User will be created by PrismaAdapter after signIn succeeds
      if (account?.provider === 'google' && user.email) {
        const userEmail = user.email
        const userName = user.name || 'Admin User'

        try {
          // Atomically upsert Admin record - single DB call prevents race conditions
          // Always update googleId on sign-in since user is actively authenticating
          const admin = await prisma.admin.upsert({
            where: { email: userEmail },
            create: {
              email: userEmail,
              googleId: account.providerAccountId,
              name: userName,
            },
            update: {
              googleId: account.providerAccountId,
              name: userName,
            },
          })

          console.log('Admin record upserted for:', userEmail, 'with ID:', admin.id)

          // Don't try to update User here - it doesn't exist yet!
          // PrismaAdapter will create it after signIn returns true
          // We'll link User to Admin in the session callback
        } catch (error) {
          console.error('Failed to upsert admin record:', error)
          return false
        }
      }

      return true
    },
    async redirect({ url, baseUrl }) {
      // Redirect to admin dashboard after successful sign in
      if (url.startsWith(baseUrl)) {
        return url
      }
      // Always redirect to admin page after sign in
      if (url === baseUrl || url === '/') {
        return `${baseUrl}/admin`
      }
      return baseUrl + '/admin'
    },
    async session({ session, user }) {
      // Add custom fields to session from database user
      if (user && session.user) {
        session.user.id = user.id
        // Explicitly handle undefined emails (matching sign-in guard logic)
        session.user.isAdmin = user.email ? user.email === process.env.ADMIN_EMAIL : false

        // Link User to Admin if not already linked
        if (user.email === process.env.ADMIN_EMAIL && !user.adminId) {
          try {
            const admin = await prisma.admin.findUnique({
              where: { email: user.email },
            })

            if (admin) {
              // Update User record with adminId if not set
              await prisma.user.update({
                where: { id: user.id },
                data: { adminId: admin.id },
              })
              session.user.adminId = admin.id
              console.log('Linked User to Admin in session callback')
            }
          } catch (error) {
            console.error('Failed to link User to Admin in session:', error)
          }
        } else {
          // Read adminId directly from User record
          session.user.adminId = user.adminId ?? undefined
        }
      }

      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Session callback:', {
          email: session.user?.email,
          isAdmin: session.user?.isAdmin,
          userId: user?.id,
          adminId: session.user?.adminId
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
})

export { handler as GET, handler as POST }