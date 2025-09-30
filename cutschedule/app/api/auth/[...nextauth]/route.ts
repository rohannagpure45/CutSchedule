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

      // Handle account linking for existing users
      if (account?.provider === 'google') {
        try {
          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { accounts: true }
          })

          if (existingUser) {
            // Check if this Google account is already linked
            const existingAccount = existingUser.accounts.find(
              acc => acc.provider === 'google' && acc.providerAccountId === account.providerAccountId
            )

            if (!existingAccount) {
              // Link the Google account to existing user
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  refresh_token: account.refresh_token,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state,
                }
              })
            }
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
                googleId: account.providerAccountId,
                name: user.name || 'Admin User',
              },
            })
          } else if (admin.googleId !== account.providerAccountId && admin.googleId === 'pending-first-login') {
            // Update Google ID if it's the first login
            await prisma.admin.update({
              where: { email: user.email! },
              data: { googleId: account.providerAccountId },
            })
          }
        } catch (error) {
          console.error('Error during sign in:', error)
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
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
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