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

    console.log(`\n🔑 Admin email from env: ${process.env.ADMIN_EMAIL}`)
    console.log(`   Does admin have a Google account? ${users.some(u => u.email === process.env.ADMIN_EMAIL && u.accounts.some(a => a.provider === 'google'))}\n`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAccounts()
