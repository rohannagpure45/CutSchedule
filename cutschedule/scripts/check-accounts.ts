/**
 * Check what User and Account records exist in the database
 */

import { prisma } from '../lib/db'

async function checkAccounts() {
  try {
    console.log('🔍 Checking database for User and Account records...\n')

    const users = await prisma.user.findMany({
      include: {
        accounts: true,
      },
    })

    if (users.length === 0) {
      console.log('⚠️  No users found in database')
    } else {
      console.log(`Found ${users.length} user(s):\n`)

      for (const user of users) {
        console.log(`📧 Email: ${user.email}`)
        console.log(`   User ID: ${user.id}`)
        console.log(`   Name: ${user.name || 'N/A'}`)
        console.log(`   Accounts: ${user.accounts.length}`)

        for (const account of user.accounts) {
          console.log(`   - Provider: ${account.provider}`)
          console.log(`     Has access_token: ${!!account.access_token}`)
          console.log(`     Has refresh_token: ${!!account.refresh_token}`)
        }
        console.log()
      }
    }

    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      console.log(`\n⚠️  ADMIN_EMAIL not set in environment`)
    } else {
      const hasGoogleAccount = users.some(u =>
        u.email === adminEmail && u.accounts.some(a => a.provider === 'google')
      )
      console.log(`\n🔑 Admin email from env: ${adminEmail}`)
      console.log(`   Does admin have a Google account? ${hasGoogleAccount}\n`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkAccounts().catch(err => {
  console.error('❌ Unhandled error:', err)
  process.exit(1)
})
