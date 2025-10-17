import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/calendar'

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

    // Validate calendar owner configuration early and exit if missing
    const ownerEmail = process.env.GOOGLE_CALENDAR_OWNER_EMAIL || process.env.ADMIN_EMAIL
    if (!ownerEmail) {
      const msg = 'Calendar sync misconfiguration: set GOOGLE_CALENDAR_OWNER_EMAIL or ADMIN_EMAIL in environment to enable syncing.'
      console.error(msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    console.log('Starting calendar sync reconciliation...')
    console.log('[Calendar Sync] Using ownerEmail:', ownerEmail)
    console.log('[Calendar Sync] Target calendarId:', process.env.GOOGLE_CALENDAR_ID || 'primary')

    // Prepare results object
    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      failed: 0,
      details: [] as Array<{
        appointmentId: string
        action: 'create' | 'update' | 'delete'
        success: boolean
        eventId?: string
        error?: string
      }>,
    }

    const now = new Date()
    // Widen selection window slightly to handle small clock/tz drift and in-progress events
    const startWindow = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour back

    // 1) Reconcile cancellations: delete calendar events for cancelled appointments
    const cancelledWithEvents = await prisma.appointment.findMany({
      where: {
        status: 'cancelled',
        googleEventId: { not: null },
      },
      select: { id: true, googleEventId: true },
    })
    console.log('[Calendar Sync] Cancelled with events count:', cancelledWithEvents.length)
    for (const apt of cancelledWithEvents) {
      try {
        const del = await deleteCalendarEvent(apt.googleEventId!, ownerEmail)
        if (del.success) {
          await prisma.appointment.update({ where: { id: apt.id }, data: { googleEventId: null } })
          results.deleted++
          results.details.push({ appointmentId: apt.id, action: 'delete', success: true })
        } else {
          const msg = (del.error || '').toLowerCase()
          if (msg.includes('not found') || msg.includes('404')) {
            // Treat missing event as already deleted; clear id and count as deleted
            await prisma.appointment.update({ where: { id: apt.id }, data: { googleEventId: null } })
            results.deleted++
            results.details.push({ appointmentId: apt.id, action: 'delete', success: true })
          } else {
            results.failed++
            results.details.push({ appointmentId: apt.id, action: 'delete', success: false, error: del.error })
          }
        }
      } catch (e: any) {
        results.failed++
        results.details.push({ appointmentId: apt.id, action: 'delete', success: false, error: e?.message || 'Unknown error' })
      }
    }

    // 2) Confirmed future appointments: ensure calendar reflects latest timing/title
    const confirmedFuture = await prisma.appointment.findMany({
      where: {
        status: 'confirmed',
        startTime: { gte: startWindow },
        endTime: { gte: now },
      },
      orderBy: { startTime: 'asc' },
    })
    console.log('[Calendar Sync] Confirmed future count:', confirmedFuture.length)
    for (const appointment of confirmedFuture) {
      try {
        if (!appointment.googleEventId) {
          // Create new event
          console.log('[Calendar Sync] Creating event for appointment:', appointment.id)
          const created = await createCalendarEvent(appointment, ownerEmail)
          if (created.success && created.eventId) {
            await prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId: created.eventId } })
            results.created++
            results.details.push({ appointmentId: appointment.id, action: 'create', success: true, eventId: created.eventId })
          } else {
            results.failed++
            results.details.push({ appointmentId: appointment.id, action: 'create', success: false, error: created.error })
          }
        } else {
          // Update existing event to the latest details
          console.log('[Calendar Sync] Updating event for appointment:', appointment.id, 'eventId:', appointment.googleEventId)
          const updated = await updateCalendarEvent(
            appointment.googleEventId,
            {
              id: appointment.id,
              clientName: appointment.clientName,
              phoneNumber: appointment.phoneNumber,
              startTime: new Date(appointment.startTime),
              endTime: new Date(appointment.endTime),
            },
            ownerEmail
          )

          if (updated.success) {
            results.updated++
            results.details.push({ appointmentId: appointment.id, action: 'update', success: true, eventId: appointment.googleEventId })
          } else {
            // Fallback: delete and create if update failed
            const del = await deleteCalendarEvent(appointment.googleEventId, ownerEmail)
            if (!del.success) {
              const msg = (del.error || '').toLowerCase()
              if (msg.includes('not found') || msg.includes('404')) {
                // Proceed to create if old event is already missing
                const created = await createCalendarEvent({
                  id: appointment.id,
                  clientName: appointment.clientName,
                  phoneNumber: appointment.phoneNumber,
                  startTime: new Date(appointment.startTime),
                  endTime: new Date(appointment.endTime),
                }, ownerEmail)
                if (created.success && created.eventId) {
                  await prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId: created.eventId } })
                  results.updated++
                  results.details.push({ appointmentId: appointment.id, action: 'update', success: true, eventId: created.eventId })
                } else {
                  results.failed++
                  results.details.push({ appointmentId: appointment.id, action: 'update', success: false, error: updated.error || created.error })
                }
              } else {
                results.failed++
                results.details.push({ appointmentId: appointment.id, action: 'delete', success: false, error: del.error })
              }
            } else {
              const created = await createCalendarEvent({
                id: appointment.id,
                clientName: appointment.clientName,
                phoneNumber: appointment.phoneNumber,
                startTime: new Date(appointment.startTime),
                endTime: new Date(appointment.endTime),
              }, ownerEmail)
              if (created.success && created.eventId) {
                await prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId: created.eventId } })
                results.updated++
                results.details.push({ appointmentId: appointment.id, action: 'update', success: true, eventId: created.eventId })
              } else {
                results.failed++
                results.details.push({ appointmentId: appointment.id, action: 'update', success: false, error: updated.error || created.error })
              }
            }
          }
        }
      } catch (error: any) {
        results.failed++
        results.details.push({ appointmentId: appointment.id, action: appointment.googleEventId ? 'update' : 'create', success: false, error: error?.message || 'Unknown error' })
      }
    }

    const allSuccess = results.failed === 0
    const message = allSuccess
      ? `Calendar sync complete. Created: ${results.created}, Updated: ${results.updated}, Deleted: ${results.deleted}.`
      : `Calendar sync partial. Created: ${results.created}, Updated: ${results.updated}, Deleted: ${results.deleted}, Failed: ${results.failed}.`

    return NextResponse.json({ success: allSuccess, message, results })

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
