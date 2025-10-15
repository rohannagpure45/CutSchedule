import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendReminderSMS, sendSMS } from '@/lib/sms'
import { addDays, addHours, startOfDay, endOfDay, subWeeks, format, addMinutes } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

// Configure function timeout for Vercel
export const maxDuration = 30

// Business timezone - all appointment times are in this timezone
const BUSINESS_TZ = 'America/New_York'

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

    const nowUTC = new Date()
    const nowBusiness = toZonedTime(nowUTC, BUSINESS_TZ)

    const results = {
      oneDayReminders: 0,
      oneHourReminders: 0,
      reEngagementMessages: 0,
      errors: [] as string[]
    }

    // Determine if we should run daily tasks (expensive operations)
    // Cron runs at 13:00 UTC which is 8 AM EST or 9 AM EDT
    // We want to run daily tasks once in the morning
    const businessHour = nowBusiness.getHours()
    const businessMinute = nowBusiness.getMinutes()

    // Run daily tasks between 8-10 AM business time (covers both EST and EDT)
    const shouldRunDailyTasks = businessHour === 8 || (businessHour === 9 && businessMinute < 30)

    if (!shouldRunDailyTasks) {
      console.log(`[Skip Daily Tasks] Business time ${businessHour}:${businessMinute.toString().padStart(2, '0')} (${BUSINESS_TZ}) outside 8:00-9:30 window`)
    } else {
      console.log(`[Running Daily Tasks] Business time ${businessHour}:${businessMinute.toString().padStart(2, '0')} (${BUSINESS_TZ})`)
    }

    // 1. Send 1-day reminders (DAILY TASK - runs once per day)
    if (shouldRunDailyTasks) {
      // Calculate tomorrow in business timezone
      const tomorrowBusiness = addDays(nowBusiness, 1)
      const tomorrowStartBusiness = startOfDay(tomorrowBusiness)
      const tomorrowEndBusiness = endOfDay(tomorrowBusiness)

      // Convert to UTC for database query
      const tomorrowStartUTC = fromZonedTime(tomorrowStartBusiness, BUSINESS_TZ)
      const tomorrowEndUTC = fromZonedTime(tomorrowEndBusiness, BUSINESS_TZ)

      const oneDayAppointments = await prisma.appointment.findMany({
        where: {
          status: 'confirmed',
          date: {
            gte: tomorrowStartUTC,
            lte: tomorrowEndUTC,
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
    // Check for appointments 55-65 minutes in the future (tighter window to avoid duplicates)
    const reminderWindowStart = addMinutes(nowUTC, 55)
    const reminderWindowEnd = addMinutes(nowUTC, 65)

    const oneHourAppointments = await prisma.appointment.findMany({
      where: {
        status: 'confirmed',
        startTime: {
          gte: reminderWindowStart,
          lte: reminderWindowEnd,
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
      // Find customers whose last appointment was 2 or 3 weeks ago (in business timezone)
      const twoWeeksAgoBusiness = subWeeks(nowBusiness, 2)
      const threeWeeksAgoBusiness = subWeeks(nowBusiness, 3)

      // Convert to UTC for database queries
      const twoWeeksAgoStartUTC = fromZonedTime(startOfDay(twoWeeksAgoBusiness), BUSINESS_TZ)
      const twoWeeksAgoEndUTC = fromZonedTime(endOfDay(twoWeeksAgoBusiness), BUSINESS_TZ)
      const threeWeeksAgoStartUTC = fromZonedTime(startOfDay(threeWeeksAgoBusiness), BUSINESS_TZ)
      const threeWeeksAgoEndUTC = fromZonedTime(endOfDay(threeWeeksAgoBusiness), BUSINESS_TZ)

      // Get customers who had their last appointment 2 weeks ago
      const reEngagementCandidates = await prisma.appointment.findMany({
        where: {
          status: 'completed',
          endTime: {
            gte: twoWeeksAgoStartUTC,
            lte: twoWeeksAgoEndUTC,
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
            gte: threeWeeksAgoStartUTC,
            lte: threeWeeksAgoEndUTC,
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

        // Batch query for customers with future appointments (scheduled in the future)
        const futureAppointments = await prisma.appointment.findMany({
          where: {
            phoneNumber: { in: phoneNumbers },
            OR: [
              { date: { gt: nowUTC } },
              { startTime: { gt: nowUTC } }
            ]
          },
          select: { phoneNumber: true },
          distinct: ['phoneNumber']
        })

        futureAppointments.forEach(appointment => {
          phoneNumbersWithFutureAppointments.add(appointment.phoneNumber)
        })

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
                gte: subWeeks(nowUTC, 2), // Within the last 2 weeks
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