import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendReminderSMS, sendSMS } from '@/lib/sms'
import { addDays, addHours, startOfDay, endOfDay, subWeeks, format } from 'date-fns'

// Configure function timeout for Vercel
export const maxDuration = 30

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

    // Determine if we should run daily tasks (expensive operations)
    // Only run once per day at 1 PM to reduce costs
    // Use tolerance to account for cron drift or scheduling variations
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const MINUTE_TOLERANCE = 5 // Allow 5-minute window to account for drift
    const shouldRunDailyTasks = currentHour === 13 && Math.abs(currentMinute - 0) <= MINUTE_TOLERANCE

    // 1. Send 1-day reminders (DAILY TASK - runs once per day)
    if (shouldRunDailyTasks) {
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

      if (oneDayAppointments.length > 0) {
        // Fetch existing reminders in batches to avoid large IN clauses
        const appointmentIds = oneDayAppointments.map(a => a.id)
        const BATCH_SIZE = 100
        const sentReminderIds = new Set<string>()

        for (let i = 0; i < appointmentIds.length; i += BATCH_SIZE) {
          const batch = appointmentIds.slice(i, i + BATCH_SIZE)
          const existingReminders = await prisma.sMSLog.findMany({
            where: {
              appointmentId: { in: batch },
              messageType: 'reminder_1day',
              status: 'sent',
            },
            select: { appointmentId: true },
          })

          existingReminders.forEach(log => {
            if (log.appointmentId) {
              sentReminderIds.add(log.appointmentId)
            }
          })
        }

        // Send reminders only to appointments without existing reminders
        for (const appointment of oneDayAppointments) {
          if (!sentReminderIds.has(appointment.id)) {
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
      }
    }

    // 2. Send 1-hour reminders (TIME-SENSITIVE - runs every 30 minutes)
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

    if (oneHourAppointments.length > 0) {
      // Fetch existing reminders in batches to avoid large IN clauses
      const appointmentIds = oneHourAppointments.map(a => a.id)
      const BATCH_SIZE = 100
      const sentReminderIds = new Set<string>()

      for (let i = 0; i < appointmentIds.length; i += BATCH_SIZE) {
        const batch = appointmentIds.slice(i, i + BATCH_SIZE)
        const existingReminders = await prisma.sMSLog.findMany({
          where: {
            appointmentId: { in: batch },
            messageType: 'reminder_1hour',
            status: 'sent',
          },
          select: { appointmentId: true },
        })

        existingReminders.forEach(log => {
          if (log.appointmentId) {
            sentReminderIds.add(log.appointmentId)
          }
        })
      }

      // Send reminders only to appointments without existing reminders
      for (const appointment of oneHourAppointments) {
        if (!sentReminderIds.has(appointment.id)) {
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
    }

    // 3. Send re-engagement messages (DAILY TASK - runs once per day)
    if (shouldRunDailyTasks) {
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

      // Combine all candidates to optimize queries
      const allCandidates = [...reEngagementCandidates, ...threeWeekCandidates]

      if (allCandidates.length > 0) {
        const BATCH_SIZE = 100

        // Build a map of phone numbers to their appointment data
        const phoneNumberMap = new Map<string, { createdAt: Date, appointment: any, type: '2weeks' | '3weeks' }>()

        reEngagementCandidates.forEach(apt => {
          phoneNumberMap.set(apt.phoneNumber, { createdAt: apt.createdAt, appointment: apt, type: '2weeks' })
        })

        threeWeekCandidates.forEach(apt => {
          // Only add if not already in map (2-week takes precedence)
          if (!phoneNumberMap.has(apt.phoneNumber)) {
            phoneNumberMap.set(apt.phoneNumber, { createdAt: apt.createdAt, appointment: apt, type: '3weeks' })
          }
        })

        const phoneNumbers = Array.from(phoneNumberMap.keys())
        const phoneNumbersWithFutureAppointments = new Set<string>()
        const phoneNumbersWithRecentMessages = new Set<string>()

        // Batch fetch future appointments
        for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
          const batch = phoneNumbers.slice(i, i + BATCH_SIZE)
          const batchData = batch.map(phone => phoneNumberMap.get(phone)!)

          const futureAppointments = await prisma.appointment.findMany({
            where: {
              phoneNumber: { in: batch },
              createdAt: {
                gt: new Date(Math.min(...batchData.map(d => d.createdAt.getTime()))),
              },
            },
            select: { phoneNumber: true, createdAt: true },
          })

          futureAppointments.forEach(apt => {
            const candidateData = phoneNumberMap.get(apt.phoneNumber)
            if (candidateData && apt.createdAt > candidateData.createdAt) {
              phoneNumbersWithFutureAppointments.add(apt.phoneNumber)
            }
          })
        }

        // Batch fetch existing re-engagement messages
        for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
          const batch = phoneNumbers.slice(i, i + BATCH_SIZE)

          const existingMessages = await prisma.sMSLog.findMany({
            where: {
              phoneNumber: { in: batch },
              messageType: {
                in: ['reschedule_2weeks', 'reschedule_3weeks']
              },
              status: 'sent',
              sentAt: {
                gte: subWeeks(now, 2), // Within the last 2 weeks
              },
            },
            select: { phoneNumber: true },
          })

          existingMessages.forEach(log => {
            phoneNumbersWithRecentMessages.add(log.phoneNumber)
          })
        }

        // Process 2-week re-engagement
        for (const appointment of reEngagementCandidates) {
          if (!phoneNumbersWithFutureAppointments.has(appointment.phoneNumber) &&
              !phoneNumbersWithRecentMessages.has(appointment.phoneNumber)) {
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
                // Mark as sent to avoid duplicate 3-week message
                phoneNumbersWithRecentMessages.add(appointment.phoneNumber)
              } else {
                results.errors.push(`Failed to send 2-week re-engagement to ${appointment.phoneNumber}: ${result.error}`)
              }
            } catch (error: any) {
              results.errors.push(`Error sending 2-week re-engagement to ${appointment.phoneNumber}: ${error.message}`)
            }
          }
        }

        // Process 3-week re-engagement
        for (const appointment of threeWeekCandidates) {
          if (!phoneNumbersWithFutureAppointments.has(appointment.phoneNumber) &&
              !phoneNumbersWithRecentMessages.has(appointment.phoneNumber)) {
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
      }
    } // End of shouldRunDailyTasks block

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