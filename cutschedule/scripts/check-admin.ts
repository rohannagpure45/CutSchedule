/**
 * Check admin configuration
 */

import { prisma } from '../lib/db'

async function checkAdmin() {
  try {
    console.log('🔍 Checking admin configuration...\n')

    const admins = await prisma.admin.findMany()

    console.log(`Found ${admins.length} admin(s):\n`)

    for (const admin of admins) {
      console.log(`📧 Email: ${admin.email}`)
      console.log(`   Google ID: ${admin.googleId}`)
      console.log(`   Name: ${admin.name || 'N/A'}`)
      console.log(`   Created: ${admin.createdAt}`)
      console.log()
    }

    console.log(`\n🔑 Admin email from env: ${process.env.ADMIN_EMAIL}`)
    console.log(`   Admin exists in database: ${admins.some(a => a.email === process.env.ADMIN_EMAIL)}\n`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkAdmin().catch(err => {
  console.error('❌ Unhandled error:', err)
  process.exit(1)
})
