import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { format, addMinutes, isWithinInterval } from 'date-fns'
import { availabilityQuerySchema } from '@/lib/utils/validation'
import { APP_CONFIG } from '@/lib/constants'
import { parseDateInLocalTimezone, getBusinessDayRange, combineDateTime } from '@/lib/utils/dates'
import { toZonedTime } from 'date-fns-tz'
import { BUSINESS_TIME_ZONE } from '@/lib/utils/timezone'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')

    if (!dateStr) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      )
    }

    // Validate date format
    const validatedQuery = availabilityQuerySchema.parse({ date: dateStr })
    const date = parseDateInLocalTimezone(validatedQuery.date)

    // Check if the date is in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) {
      return NextResponse.json({
        available: false,
        slots: [],
        reason: 'Date is in the past'
      })
    }

    // Check if date is beyond max advance booking days
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + APP_CONFIG.MAX_ADVANCE_BOOKING_DAYS)
    if (date > maxDate) {
      return NextResponse.json({
        available: false,
        slots: [],
        reason: `Bookings are only available ${APP_CONFIG.MAX_ADVANCE_BOOKING_DAYS} days in advance`
      })
    }

    // Check for available slots on this date
    const { start: dayStart, endExclusive: dayEnd } = getBusinessDayRange(date)
    const availableSlots = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: dayStart,
          lt: dayEnd,
        }
      }
    })

    // If no available slots defined for this date, nothing is available
    if (availableSlots.length === 0) {
      return NextResponse.json({
        available: false,
        slots: [],
        reason: 'No available time slots configured for this date'
      })
    }

    // Get only confirmed appointments for this date (completed and cancelled don't block slots)
    const appointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: dayStart,
          lt: dayEnd,
        },
        status: 'confirmed',
      },
      select: {
        startTime: true,
        endTime: true,
      }
    })

    // Generate available time slots based on available slots
    const slots = generateAvailableSlots(
      appointments,
      date,
      availableSlots
    )

    return NextResponse.json({
      available: slots.length > 0,
      slots,
      appointmentDuration: APP_CONFIG.APPOINTMENT_DURATION,
      bufferTime: APP_CONFIG.BUFFER_TIME
    })

  } catch (error) {
    console.error('Error fetching availability:', error)

    if (error instanceof Error && error.message.includes('Invalid')) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}

function generateAvailableSlots(
  appointments: Array<{ startTime: Date; endTime: Date }>,
  targetDate: Date,
  availableSlots: Array<{ startTime: string; endTime: string }>
): string[] {
  const slots: string[] = []

  // Determine the target business date key (yyyy-MM-dd in business TZ)
  const targetZoned = toZonedTime(targetDate, BUSINESS_TIME_ZONE)
  const dateKey = format(targetZoned, 'yyyy-MM-dd')

  const now = new Date()
  const nowZonedKey = format(toZonedTime(now, BUSINESS_TIME_ZONE), 'yyyy-MM-dd')
  const isToday = dateKey === nowZonedKey

  // Loop through each available slot window
  for (const availableWindow of availableSlots) {
    // Build window bounds as UTC instants by interpreting times in business timezone for the date
    const windowStart = combineDateTime(dateKey, availableWindow.startTime)
    const windowEnd = combineDateTime(dateKey, availableWindow.endTime)

    // If it's today, start from current time (rounded up to next 15-min interval)
    let currentSlot = new Date(windowStart)

    if (isToday) {
      // Round up the current time in business TZ to next 15m, then align to UTC
      const nowZoned = toZonedTime(now, BUSINESS_TIME_ZONE)
      const minutes = nowZoned.getMinutes()
      const roundedMinutes = Math.ceil(minutes / 15) * 15
      nowZoned.setMinutes(roundedMinutes, 0, 0)
      const roundedKey = format(nowZoned, 'yyyy-MM-dd HH:mm')
      const [d, t] = roundedKey.split(' ')
      const roundedUtc = combineDateTime(d, t)
      if (roundedUtc > windowStart) {
        currentSlot = roundedUtc
      }
    }

    // Generate slots every 15 minutes within this available window
    while (currentSlot < windowEnd) {
      const slotEnd = addMinutes(currentSlot, APP_CONFIG.APPOINTMENT_DURATION)

      // Check if slot would extend beyond this available window
      if (slotEnd > windowEnd) {
        break
      }

      // Check if this slot conflicts with any appointment (including buffer)
      const isBlockedByAppointment = appointments.some(apt => {
        const aptStart = new Date(apt.startTime)
        const aptEndWithBuffer = addMinutes(new Date(apt.endTime), APP_CONFIG.BUFFER_TIME)

        // Check for overlap: slot conflicts if it overlaps with appointment + buffer
        return (
          isWithinInterval(currentSlot, { start: aptStart, end: aptEndWithBuffer }) ||
          isWithinInterval(slotEnd, { start: aptStart, end: aptEndWithBuffer }) ||
          isWithinInterval(aptStart, { start: currentSlot, end: slotEnd }) ||
          isWithinInterval(aptEndWithBuffer, { start: currentSlot, end: slotEnd })
        )
      })

      if (!isBlockedByAppointment) {
        const timeStr = format(currentSlot, 'HH:mm')
        // Avoid duplicate slots if windows overlap
        if (!slots.includes(timeStr)) {
          slots.push(timeStr)
        }
      }

      currentSlot = addMinutes(currentSlot, APP_CONFIG.SLOT_INTERVAL)
    }
  }

  // Sort slots chronologically
  return slots.sort()
}
