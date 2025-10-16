import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createCalendarEvent } from '@/lib/calendar'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication - rely on OAuth development mode allowed test users
    const session = await getServerSession(authOptions)

    // Check if session exists
    if (!session) {
      console.warn('[Auth Audit] Calendar sync attempted without session')
      return NextResponse.json(
        { error: 'Unauthorized - No session' },
        { status: 401 }
      )
    }

    // Check if user exists in session
    if (!session.user) {
      console.warn('[Auth Audit] Calendar sync attempted with session but no user')
      return NextResponse.json(
        { error: 'Unauthorized - No user in session' },
        { status: 401 }
      )
    }

    // Check if user has email (required for OAuth users)
    if (!session.user.email) {
      console.warn('[Auth Audit] Calendar sync attempted by user without email')
      return NextResponse.json(
        { error: 'Unauthorized - No email in session' },
        { status: 401 }
      )
    }

    console.log(`[Auth Audit] Calendar sync authorized for user: ${session.user.email}`)

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

        const result = await createCalendarEvent(appointment, session?.user?.email)

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
