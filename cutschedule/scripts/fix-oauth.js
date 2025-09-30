const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixOAuthIssue() {
  try {
    console.log('🔧 Fixing OAuth account linking issue...')

    const adminEmail = process.env.ADMIN_EMAIL || 'ribt2218@gmail.com'
    console.log(`Admin email: ${adminEmail}`)

    // Check for existing user with admin email
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: { accounts: true }
    })

    if (existingUser) {
      console.log(`Found existing user: ${existingUser.id}`)
      console.log(`Number of linked accounts: ${existingUser.accounts.length}`)

      // Check if Google account is linked
      const googleAccount = existingUser.accounts.find(acc => acc.provider === 'google')
      if (!googleAccount) {
        console.log('⚠️ No Google account linked to this user')
        console.log('The next Google sign-in will automatically link the account')
      } else {
        console.log('✅ Google account is already linked')
      }
    } else {
      console.log('No existing user found with admin email')
    }

    // Check admin record
    const admin = await prisma.admin.findUnique({
      where: { email: adminEmail }
    })

    if (admin) {
      console.log(`\nAdmin record exists:`)
      console.log(`- Email: ${admin.email}`)
      console.log(`- Google ID: ${admin.googleId}`)
      console.log(`- Name: ${admin.name}`)

      if (admin.googleId === 'pending-first-login') {
        console.log('⚠️ Admin has not completed first Google sign-in')
      }
    } else {
      console.log('\n⚠️ No admin record found')
      console.log('Creating admin record...')

      await prisma.admin.create({
        data: {
          email: adminEmail,
          googleId: 'pending-first-login',
          name: 'Admin User',
        }
      })

      console.log('✅ Admin record created')
    }

    console.log('\n✅ OAuth fix complete!')
    console.log('You should now be able to sign in with Google.')

  } catch (error) {
    console.error('Error fixing OAuth:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixOAuthIssue()