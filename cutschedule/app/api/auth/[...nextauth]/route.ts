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

      // Update admin and user records atomically in a transaction
      // Retry entire transaction from outside to avoid holding DB locks during backoff
      if (account?.provider === 'google' && user.email && user.id) {
        const userEmail = user.email
        const userName = user.name || 'Admin User'
        const userId = user.id

        const maxRetries = 3
        const baseDelayMs = 50

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            await prisma.$transaction(async (tx) => {
              // Atomically upsert Admin record - single DB call prevents race conditions
              // Always update googleId on sign-in since user is actively authenticating
              const admin = await tx.admin.upsert({
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

              const adminId = admin.id
              console.log('Admin record upserted for:', userEmail)

              // Update User record with adminId
              // This may fail with P2025 if PrismaAdapter hasn't created User yet
              await tx.user.update({
                where: { id: userId },
                data: { adminId },
              })
            })

            // Transaction succeeded - exit retry loop
            console.log('Successfully linked admin and user records in transaction')
            break

          } catch (error: any) {
            // Transaction automatically rolled back
            // P2025 = Record not found (User might not be created by PrismaAdapter yet)
            if (error?.code === 'P2025') {
              if (attempt < maxRetries) {
                // Backoff delay OUTSIDE the transaction to avoid holding locks
                const delayMs = baseDelayMs * Math.pow(2, attempt)
                console.log(`User not found (attempt ${attempt + 1}/${maxRetries + 1}), retrying after ${delayMs}ms...`)
                await new Promise(resolve => setTimeout(resolve, delayMs))
                // Continue to next attempt with fresh transaction
              } else {
                // Retries exhausted
                console.error(`User update failed after ${maxRetries + 1} attempts`)
                console.error('Transaction failed - admin/user records not updated:', error)
                return false
              }
            } else {
              // Non-P2025 error - fail immediately
              console.error('Transaction failed - admin/user records not updated:', error)
              return false
            }
          }
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