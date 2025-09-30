import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/db'

const handler = NextAuth({
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

      // Update admin record in database
      if (account?.provider === 'google') {
        try {
          const admin = await prisma.admin.findUnique({
            where: { email: user.email! },
          })

          if (!admin) {
            console.log('Creating new admin record for:', user.email)
            await prisma.admin.create({
              data: {
                email: user.email!,
                googleId: account.providerAccountId,
                name: user.name || 'Admin User',
              },
            })
          } else if (admin.googleId === 'pending-first-login') {
            // Update Google ID on first login
            await prisma.admin.update({
              where: { email: user.email! },
              data: {
                googleId: account.providerAccountId,
                name: user.name || admin.name,
              },
            })
          }
        } catch (error) {
          console.error('Error updating admin record:', error)
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
    async session({ session, token }) {
      // Add admin flag to session from JWT token
      if (token && session.user) {
        session.user.isAdmin = token.isAdmin as boolean
        session.user.adminId = token.adminId as string
      }

      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Session callback:', {
          email: session.user?.email,
          isAdmin: session.user?.isAdmin,
          tokenIsAdmin: token?.isAdmin
        })
      }

      return session
    },
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        token.isAdmin = user.email === process.env.ADMIN_EMAIL
        token.adminId = user.id
        token.email = user.email
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }

      // Subsequent requests - ensure admin flag is set
      if (token.email === process.env.ADMIN_EMAIL) {
        token.isAdmin = true
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
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
})

export { handler as GET, handler as POST }