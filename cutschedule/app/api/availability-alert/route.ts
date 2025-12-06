import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendAvailabilityAlertSMS } from '@/lib/sms'
import { subMonths, format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { BUSINESS_TIME_ZONE } from '@/lib/utils/timezone'

// Timeout per SMS send to prevent serverless function timeouts
const SMS_TIMEOUT_MS = 10000
// Max clients per request to prevent very large invocations
const MAX_CLIENTS_PER_REQUEST = 50

// Wrap a promise with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SMS send timeout')), ms)
    ),
  ])
}

interface EligibleClient {
  phoneNumber: string
  clientName: string
  appointmentCount: number
}

async function getEligibleClients(): Promise<EligibleClient[]> {
  const now = new Date()
  const sixMonthsAgo = subMonths(now, 6)

  // Get today's start in business timezone for rate limiting
  // Convert to business TZ, format as date string, then convert midnight back to UTC
  const todayInBusinessTZ = toZonedTime(now, BUSINESS_TIME_ZONE)
  const todayKey = format(todayInBusinessTZ, 'yyyy-MM-dd')
  const todayStart = fromZonedTime(`${todayKey}T00:00:00.000`, BUSINESS_TIME_ZONE)

  // Get phone numbers that received availability_alert today (for rate limiting)
  const notifiedToday = await prisma.sMSLog.findMany({
    where: {
      messageType: 'availability_alert',
      sentAt: {
        gte: todayStart,
      },
    },
    select: {
      phoneNumber: true,
    },
  })
  const notifiedTodaySet = new Set(notifiedToday.map((log) => log.phoneNumber))

  // Get all appointments from the past 6 months (including cancelled)
  // A recurring client is anyone who has booked 2+ times, regardless of status
  // Order by date ascending so the last occurrence has the most recent name
  // Filter out null/empty phone numbers to avoid SMS failures
  const appointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: sixMonthsAgo,
      },
      phoneNumber: {
        not: '',
        isNot: null,
      },
    },
    select: {
      phoneNumber: true,
      clientName: true,
    },
    orderBy: {
      date: 'asc',
    },
  })

  // Group by phone number and count appointments
  const clientMap = new Map<string, { clientName: string; count: number }>()

  for (const appt of appointments) {
    // Skip empty phone numbers (additional safety check)
    if (!appt.phoneNumber || appt.phoneNumber.trim() === '') continue

    const existing = clientMap.get(appt.phoneNumber)
    if (existing) {
      existing.count++
      existing.clientName = appt.clientName // Update to the most recent name
    } else {
      clientMap.set(appt.phoneNumber, {
        clientName: appt.clientName,
        count: 1,
      })
    }
  }

  // Filter to clients with 2+ appointments who haven't been notified today
  const eligibleClients: EligibleClient[] = []

  for (const [phoneNumber, data] of clientMap.entries()) {
    if (data.count >= 2 && !notifiedTodaySet.has(phoneNumber)) {
      eligibleClients.push({
        phoneNumber,
        clientName: data.clientName,
        appointmentCount: data.count,
      })
    }
  }

  return eligibleClients
}

// Mask phone number to protect PII: "1234567890" -> "***-***-7890"
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '***'
  return `***-***-${phone.slice(-4)}`
}

// GET - Preview eligible clients count
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eligibleClients = await getEligibleClients()
    const includeDetails = request.nextUrl.searchParams.get('includeDetails') === 'true'

    // Default response: only count (no PII)
    const response: {
      eligibleCount: number
      clients?: { clientName: string; phoneNumber: string }[]
    } = {
      eligibleCount: eligibleClients.length,
    }

    // Include masked client details only when explicitly requested
    if (includeDetails) {
      response.clients = eligibleClients.map((client) => ({
        clientName: client.clientName,
        phoneNumber: maskPhone(client.phoneNumber),
      }))
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error fetching eligible clients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch eligible clients' },
      { status: 500 }
    )
  }
}

// POST - Send availability alerts to eligible clients
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dryRun = process.env.AVAILABILITY_ALERT_DRY_RUN === 'true'
    const eligibleClients = await getEligibleClients()

    if (eligibleClients.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        message: 'No eligible clients to notify',
        dryRun,
      })
    }

    // Guard against very large invocations that could exceed serverless limits
    if (eligibleClients.length > MAX_CLIENTS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many clients (${eligibleClients.length}). Maximum ${MAX_CLIENTS_PER_REQUEST} per request. Consider using a background job for large batches.`,
        },
        { status: 400 }
      )
    }

    // Process SMS sends concurrently for better performance
    // Use Promise.allSettled to handle individual failures gracefully
    const CONCURRENCY_LIMIT = 5
    let sent = 0
    let failed = 0

    // Process in batches to limit concurrency
    for (let i = 0; i < eligibleClients.length; i += CONCURRENCY_LIMIT) {
      const batch = eligibleClients.slice(i, i + CONCURRENCY_LIMIT)
      const results = await Promise.allSettled(
        batch.map((client) =>
          withTimeout(
            sendAvailabilityAlertSMS(client.phoneNumber, dryRun),
            SMS_TIMEOUT_MS
          )
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          sent++
        } else {
          failed++
        }
      }
    }

    if (dryRun) {
      console.log(`[DRY RUN] Complete: ${sent} messages would be sent`)
    }

    return NextResponse.json({
      sent,
      failed,
      dryRun,
    })
  } catch (error) {
    console.error('Error sending availability alerts:', error)
    return NextResponse.json(
      { error: 'Failed to send availability alerts' },
      { status: 500 }
    )
  }
}
