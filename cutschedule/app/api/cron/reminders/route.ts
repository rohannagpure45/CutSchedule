import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendReminderSMS, sendSMS } from '@/lib/sms'
import { addDays, addHours, startOfDay, endOfDay, subWeeks, format } from 'date-fns'

// Verify the request is from a legitimate cron service
function verifyCronAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron authentication
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    const results = {
      oneDayReminders: 0,
      oneHourReminders: 0,
      reEngagementMessages: 0,
      errors: [] as string[]
    }

    // 1. Send 1-day reminders
    const tomorrow = addDays(now, 1)
    const oneDayAppointments = await prisma.appointment.findMany({
      where: {
        status: 'confirmed',
        date: {
          gte: startOfDay(tomorrow),
          lte: endOfDay(tomorrow),
        },
      },
    })

    console.log(`Found ${oneDayAppointments.length} appointments for 1-day reminders`)

    for (const appointment of oneDayAppointments) {
      // Check if we already sent a 1-day reminder
      const existingReminder = await prisma.sMSLog.findFirst({
        where: {
          appointmentId: appointment.id,
          messageType: 'reminder_1day',
          status: 'sent',
        },
      })

      if (!existingReminder) {
        try {
          const result = await sendReminderSMS(appointment, 'reminder_1day')
          if (result.success) {
            results.oneDayReminders++
            console.log(`Sent 1-day reminder for appointment ${appointment.id}`)
          } else {
            results.errors.push(`Failed to send 1-day reminder for ${appointment.id}: ${result.error}`)
          }
        } catch (error: any) {
          results.errors.push(`Error sending 1-day reminder for ${appointment.id}: ${error.message}`)
        }
      }
    }

    // 2. Send 1-hour reminders
    const oneHourLater = addHours(now, 1)
    const oneHourAppointments = await prisma.appointment.findMany({
      where: {
        status: 'confirmed',
        startTime: {
          gte: addHours(oneHourLater, -0.25), // 15 minutes before
          lte: addHours(oneHourLater, 0.25),  // 15 minutes after
        },
      },
    })

    console.log(`Found ${oneHourAppointments.length} appointments for 1-hour reminders`)

    for (const appointment of oneHourAppointments) {
      // Check if we already sent a 1-hour reminder
      const existingReminder = await prisma.sMSLog.findFirst({
        where: {
          appointmentId: appointment.id,
          messageType: 'reminder_1hour',
          status: 'sent',
        },
      })

      if (!existingReminder) {
        try {
          const result = await sendReminderSMS(appointment, 'reminder_1hour')
          if (result.success) {
            results.oneHourReminders++
            console.log(`Sent 1-hour reminder for appointment ${appointment.id}`)
          } else {
            results.errors.push(`Failed to send 1-hour reminder for ${appointment.id}: ${result.error}`)
          }
        } catch (error: any) {
          results.errors.push(`Error sending 1-hour reminder for ${appointment.id}: ${error.message}`)
        }
      }
    }

    // 3. Send re-engagement messages
    // Find customers whose last appointment was 2 weeks ago
    const twoWeeksAgo = subWeeks(now, 2)
    const threeWeeksAgo = subWeeks(now, 3)

    // Get customers who had their last appointment 2 weeks ago
    const reEngagementCandidates = await prisma.appointment.findMany({
      where: {
        status: 'completed',
        endTime: {
          gte: startOfDay(twoWeeksAgo),
          lte: endOfDay(twoWeeksAgo),
        },
      },
      distinct: ['phoneNumber'],
    })

    console.log(`Found ${reEngagementCandidates.length} candidates for 2-week re-engagement`)

    for (const appointment of reEngagementCandidates) {
      // Check if customer has any appointments after this one
      const futureAppointments = await prisma.appointment.findFirst({
        where: {
          phoneNumber: appointment.phoneNumber,
          createdAt: {
            gt: appointment.createdAt,
          },
        },
      })

      // Check if we already sent a re-engagement message to this customer
      const existingReEngagement = await prisma.sMSLog.findFirst({
        where: {
          phoneNumber: appointment.phoneNumber,
          messageType: 'reschedule_2weeks',
          status: 'sent',
          sentAt: {
            gte: subWeeks(now, 1), // Within the last week
          },
        },
      })

      if (!futureAppointments && !existingReEngagement) {
        try {
          const result = await sendSMS(
            appointment.phoneNumber,
            'reschedule_2weeks',
            {
              clientName: appointment.clientName,
              date: '',
              time: '',
              appointmentId: appointment.id,
            }
          )
          if (result.success) {
            results.reEngagementMessages++
            console.log(`Sent 2-week re-engagement to ${appointment.phoneNumber}`)
          } else {
            results.errors.push(`Failed to send 2-week re-engagement to ${appointment.phoneNumber}: ${result.error}`)
          }
        } catch (error: any) {
          results.errors.push(`Error sending 2-week re-engagement to ${appointment.phoneNumber}: ${error.message}`)
        }
      }
    }

    // Also handle 3-week re-engagement
    const threeWeekCandidates = await prisma.appointment.findMany({
      where: {
        status: 'completed',
        endTime: {
          gte: startOfDay(threeWeeksAgo),
          lte: endOfDay(threeWeeksAgo),
        },
      },
      distinct: ['phoneNumber'],
    })

    console.log(`Found ${threeWeekCandidates.length} candidates for 3-week re-engagement`)

    for (const appointment of threeWeekCandidates) {
      // Check if customer has any appointments after this one
      const futureAppointments = await prisma.appointment.findFirst({
        where: {
          phoneNumber: appointment.phoneNumber,
          createdAt: {
            gt: appointment.createdAt,
          },
        },
      })

      // Check if we already sent any re-engagement message to this customer recently
      const existingReEngagement = await prisma.sMSLog.findFirst({
        where: {
          phoneNumber: appointment.phoneNumber,
          messageType: {
            in: ['reschedule_2weeks', 'reschedule_3weeks']
          },
          status: 'sent',
          sentAt: {
            gte: subWeeks(now, 2), // Within the last 2 weeks
          },
        },
      })

      if (!futureAppointments && !existingReEngagement) {
        try {
          const result = await sendSMS(
            appointment.phoneNumber,
            'reschedule_3weeks',
            {
              clientName: appointment.clientName,
              date: '',
              time: '',
              appointmentId: appointment.id,
            }
          )
          if (result.success) {
            results.reEngagementMessages++
            console.log(`Sent 3-week re-engagement to ${appointment.phoneNumber}`)
          } else {
            results.errors.push(`Failed to send 3-week re-engagement to ${appointment.phoneNumber}: ${result.error}`)
          }
        } catch (error: any) {
          results.errors.push(`Error sending 3-week re-engagement to ${appointment.phoneNumber}: ${error.message}`)
        }
      }
    }

    console.log('Cron job completed:', results)

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })

  } catch (error) {
    console.error('Error in cron job:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Allow POST as well for flexibility with different cron services
  return GET(request)
}