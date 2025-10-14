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

      // Update admin and user records
      if (account?.provider === 'google' && user.email && user.id) {
        try {
          const userEmail = user.email
          const userName = user.name || 'Admin User'
          const userId = user.id

          // Handle Admin record
          let adminId: string
          const admin = await prisma.admin.findUnique({
            where: { email: userEmail },
          })

          if (!admin) {
            console.log('Creating new admin record for:', userEmail)
            const newAdmin = await prisma.admin.create({
              data: {
                email: userEmail,
                googleId: account.providerAccountId,
                name: userName,
              },
            })
            adminId = newAdmin.id
          } else if (admin.googleId === 'pending-first-login') {
            // Update Google ID on first login
            await prisma.admin.update({
              where: { email: userEmail },
              data: {
                googleId: account.providerAccountId,
                name: userName || admin.name,
              },
            })
            adminId = admin.id
          } else {
            adminId = admin.id
          }

          // Update User record with adminId (retry once if not found)
          try {
            await prisma.user.update({
              where: { id: userId },
              data: { adminId },
            })
          } catch (userUpdateError: any) {
            // User might not be created yet, wait and retry once
            if (userUpdateError?.code === 'P2025') {
              console.log('User not found, retrying after short delay...')
              await new Promise(resolve => setTimeout(resolve, 100))
              await prisma.user.update({
                where: { id: userId },
                data: { adminId },
              })
            } else {
              throw userUpdateError
            }
          }

          console.log('Successfully linked admin and user records')
        } catch (error) {
          console.error('Error updating admin/user records:', error)
          // Prevent sign-in if updates fail to avoid inconsistent state
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
        // Read adminId directly from User record (populated at sign-in)
        session.user.adminId = user.adminId ?? undefined
      }

      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Session callback:', {
          email: session.user?.email,
          isAdmin: session.user?.isAdmin,
          userId: user?.id
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