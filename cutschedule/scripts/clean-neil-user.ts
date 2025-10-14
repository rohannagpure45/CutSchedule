/**
 * Clean up orphaned User record for Neil
 * This allows PrismaAdapter to create both User and Account together
 */

import { prisma } from '../lib/db'

async function cleanUser() {
  try {
    console.log('🧹 Cleaning orphaned User record for Neil...\n')

    const adminEmail = 'neil.wishart.devnani@gmail.com'

    // Check current state
    const user = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: {
        accounts: true,
        sessions: true,
      },
    })

    if (!user) {
      console.log('✅ No User record found for:', adminEmail)
      console.log('   Ready for clean sign-in attempt.\n')
      return
    }

    console.log('📧 Found User:', user.email)
    console.log('   User ID:', user.id)
    console.log('   Accounts:', user.accounts.length)
    console.log('   Sessions:', user.sessions.length)

    if (user.accounts.length > 0) {
      console.log('\n⚠️  User has Account records - should not delete!')
      console.log('   This might be a working account.\n')
      return
    }

    console.log('\n🗑️  Deleting orphaned User record (no accounts)...')

    await prisma.user.delete({
      where: { id: user.id },
    })

    console.log('✅ Successfully deleted orphaned User record')
    console.log('   Neil can now sign in and PrismaAdapter will create User+Account together.\n')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanUser()
