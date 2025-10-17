/**
 * Sync appointments to Google Calendar
 *
 * This script finds all appointments that don't have a Google Calendar event
 * and attempts to create calendar events for them.
 *
 * Usage: npx tsx scripts/sync-appointments-to-calendar.ts
 */

import { prisma } from '../lib/db'
import { createCalendarEvent } from '../lib/calendar'

async function syncAppointmentsToCalendar() {
  console.log('🔄 Starting calendar sync...\n')

  try {
    // Find all confirmed appointments without a Google Calendar event
    const appointments = await prisma.appointment.findMany({
      where: {
        googleEventId: null,
        status: 'confirmed',
        startTime: {
          gte: new Date(), // Only sync future appointments
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    if (appointments.length === 0) {
      console.log('✅ No appointments need syncing. All appointments are up to date!')
      return
    }

    console.log(`📋 Found ${appointments.length} appointment(s) to sync:\n`)

    let successCount = 0
    let failureCount = 0

    // Resolve and validate calendar owner email once
    const ownerEmail = process.env.GOOGLE_CALENDAR_OWNER_EMAIL || process.env.ADMIN_EMAIL
    if (!ownerEmail) {
      throw new Error('Calendar sync requires GOOGLE_CALENDAR_OWNER_EMAIL or ADMIN_EMAIL to be set')
    }

    for (const appointment of appointments) {
      console.log(`\n⏳ Syncing appointment ${appointment.id}:`)
      console.log(`   Client: ${appointment.clientName}`)
      console.log(`   Phone: ${appointment.phoneNumber}`)
      console.log(`   Date: ${appointment.startTime.toLocaleString('en-US', { timeZone: 'America/New_York' })}`)

      try {
        const result = await createCalendarEvent(appointment, ownerEmail)

        if (result.success && result.eventId) {
          // Update appointment with Google Calendar event ID
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { googleEventId: result.eventId },
          })

          console.log(`   ✅ Successfully synced! Calendar Event ID: ${result.eventId}`)
          successCount++
        } else {
          console.error(`   ❌ Failed to sync: ${result.error}`)
          failureCount++
        }
      } catch (error) {
        console.error(`   ❌ Error syncing: ${error instanceof Error ? error.message : 'Unknown error'}`)
        failureCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 Sync Summary:')
    console.log(`   Total appointments: ${appointments.length}`)
    console.log(`   ✅ Successfully synced: ${successCount}`)
    console.log(`   ❌ Failed to sync: ${failureCount}`)
    console.log('='.repeat(60) + '\n')

    if (failureCount > 0) {
      console.error('⚠️  Some appointments failed to sync. Please check the errors above.')
      console.error('💡 Common issues:')
      console.error('   - Admin has not signed in with Google yet')
      console.error('   - Google Calendar API credentials are not configured')
      console.error('   - OAuth token has expired or is invalid')
      process.exit(1)
    } else {
      console.log('🎉 All appointments successfully synced to Google Calendar!')
    }

  } catch (error) {
    console.error('❌ Fatal error during sync:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the sync
syncAppointmentsToCalendar().catch(err => {
  console.error('❌ Unhandled error:', err)
  process.exit(1)
})
