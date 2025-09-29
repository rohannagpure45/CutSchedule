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

      // Check if admin exists, if not create it
      const admin = await prisma.admin.findUnique({
        where: { email: user.email! },
      })

      if (!admin) {
        console.log('Creating new admin record for:', user.email)
        await prisma.admin.create({
          data: {
            email: user.email!,
            googleId: account!.providerAccountId,
            name: user.name || 'Admin User',
          },
        })
      } else if (admin.googleId !== account!.providerAccountId) {
        // Update Google ID if it changed
        await prisma.admin.update({
          where: { email: user.email! },
          data: { googleId: account!.providerAccountId },
        })
      }

      // Store refresh token for Google Calendar API if available
      if (account?.refresh_token) {
        console.log('Storing refresh token for Calendar API')
        // In a real app, store this securely in database
        // For now, we'll use the environment variable approach
      }

      return true
    },
    async session({ session, token, user }) {
      // Add admin flag to session
      if (session.user?.email) {
        const admin = await prisma.admin.findUnique({
          where: { email: session.user.email },
        })

        return {
          ...session,
          user: {
            ...session.user,
            isAdmin: !!admin,
            adminId: admin?.id,
          },
        }
      }

      return session
    },
    async jwt({ token, account, user }) {
      // Persist additional user info in JWT
      if (account && user) {
        token.isAdmin = user.email === process.env.ADMIN_EMAIL
        token.adminId = user.id
      }
      return token
    },
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
    signOut: '/admin/login',
  },
  session: {
    strategy: 'database',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
})

export { handler as GET, handler as POST }