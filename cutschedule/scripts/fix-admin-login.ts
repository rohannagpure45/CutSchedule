/**
 * Fix admin login issue
 *
 * This script updates the Admin record to set googleId to 'pending-first-login'
 * so that the authentication flow can properly link the User/Account records
 * on the next sign-in attempt.
 *
 * Usage: npx tsx scripts/fix-admin-login.ts
 */

import { prisma } from '../lib/db'

async function fixAdminLogin() {
  try {
    console.log('🔧 Fixing admin login issue...\n')

    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      console.error('❌ ADMIN_EMAIL environment variable is not set')
      process.exit(1)
    }

    console.log(`📧 Admin email from environment: ${adminEmail}`)

    // Check if admin exists
    const admin = await prisma.admin.findUnique({
      where: { email: adminEmail },
    })

    if (!admin) {
      console.error(`❌ No admin found with email: ${adminEmail}`)
      console.error('💡 The admin record needs to exist before running this fix.')
      process.exit(1)
    }

    console.log(`\n✅ Found admin record:`)
    console.log(`   Email: ${admin.email}`)
    console.log(`   Current Google ID: ${admin.googleId}`)
    console.log(`   Name: ${admin.name || 'N/A'}`)

    // Check if User/Account records exist
    const user = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: {
        accounts: {
          where: { provider: 'google' },
        },
      },
    })

    if (user && user.accounts.length > 0) {
      console.log('\n✅ User and Google Account records already exist!')
      console.log('   The admin should be able to sign in successfully.')
      console.log('\n💡 If login is still failing, check the server logs for errors.')
      return
    }

    console.log('\n⚠️  No User/Account records found for this admin.')
    console.log('   Updating googleId to trigger first-login flow...\n')

    // Update admin record to trigger first-login flow
    const updatedAdmin = await prisma.admin.update({
      where: { email: adminEmail },
      data: {
        googleId: 'pending-first-login',
      },
    })

    console.log('✅ Successfully updated admin record!')
    console.log(`   Email: ${updatedAdmin.email}`)
    console.log(`   Google ID: ${updatedAdmin.googleId}`)
    console.log('\n🎉 Admin can now sign in with Google!')
    console.log('   The authentication flow will properly link the User/Account records on next login.\n')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

fixAdminLogin()
