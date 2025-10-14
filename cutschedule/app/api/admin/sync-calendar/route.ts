import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { createCalendarEvent } from '@/lib/calendar'

export async function POST(request: NextRequest) {
  try {
    // Validate required environment variables
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      console.error('ADMIN_EMAIL environment variable is not configured')
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_EMAIL not configured' },
        { status: 500 }
      )
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== adminEmail) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting calendar sync for unsynced appointments...')

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
      return NextResponse.json({
        success: true,
        message: 'No appointments need syncing. All appointments are up to date!',
        results: {
          total: 0,
          synced: 0,
          failed: 0,
        },
      })
    }

    console.log(`Found ${appointments.length} appointments to sync`)

    const results = {
      total: appointments.length,
      synced: 0,
      failed: 0,
      details: [] as Array<{
        appointmentId: string
        clientName: string
        startTime: string
        success: boolean
        eventId?: string
        error?: string
      }>,
    }

    // Sync each appointment
    for (const appointment of appointments) {
      try {
        console.log(`Syncing appointment ${appointment.id} for ${appointment.clientName}`)

        const result = await createCalendarEvent(appointment)

        if (result.success && result.eventId) {
          // Update appointment with Google Calendar event ID
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { googleEventId: result.eventId },
          })

          results.synced++
          results.details.push({
            appointmentId: appointment.id,
            clientName: appointment.clientName,
            startTime: appointment.startTime.toISOString(),
            success: true,
            eventId: result.eventId,
          })

          console.log(`Successfully synced appointment ${appointment.id}`)
        } else {
          results.failed++
          results.details.push({
            appointmentId: appointment.id,
            clientName: appointment.clientName,
            startTime: appointment.startTime.toISOString(),
            success: false,
            error: result.error,
          })

          console.error(`Failed to sync appointment ${appointment.id}:`, result.error)
        }
      } catch (error) {
        results.failed++
        results.details.push({
          appointmentId: appointment.id,
          clientName: appointment.clientName,
          startTime: appointment.startTime.toISOString(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        console.error(`Error syncing appointment ${appointment.id}:`, error)
      }
    }

    const allSuccess = results.failed === 0
    const message = allSuccess
      ? `Successfully synced ${results.synced} appointment(s) to Google Calendar!`
      : `Synced ${results.synced} appointment(s). ${results.failed} failed.`

    return NextResponse.json({
      success: allSuccess,
      message,
      results,
    })

  } catch (error) {
    console.error('Error in calendar sync endpoint:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync appointments to calendar',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
