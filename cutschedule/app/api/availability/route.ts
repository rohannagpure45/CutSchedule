import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { startOfDay, endOfDay, format, addMinutes, isWithinInterval } from 'date-fns'
import { availabilityQuerySchema } from '@/lib/utils/validation'
import { APP_CONFIG } from '@/lib/constants'
import { parseDateInLocalTimezone } from '@/lib/utils/dates'

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
    const availableSlots = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: startOfDay(date),
          lte: endOfDay(date),
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
          gte: startOfDay(date),
          lte: endOfDay(date),
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

  // Create base date for time parsing
  const baseDate = new Date(targetDate)
  baseDate.setHours(0, 0, 0, 0)

  const now = new Date()
  const isToday = targetDate.toDateString() === now.toDateString()

  // Loop through each available slot window
  for (const availableWindow of availableSlots) {
    const [startHour, startMinute] = availableWindow.startTime.split(':').map(Number)
    const [endHour, endMinute] = availableWindow.endTime.split(':').map(Number)

    const windowStart = new Date(baseDate)
    windowStart.setHours(startHour, startMinute, 0, 0)

    const windowEnd = new Date(baseDate)
    windowEnd.setHours(endHour, endMinute, 0, 0)

    // If it's today, start from current time (rounded up to next 15-min interval)
    let currentSlot = new Date(windowStart)

    if (isToday) {
      const currentTime = new Date(baseDate)
      currentTime.setHours(now.getHours(), now.getMinutes(), 0, 0)

      if (currentTime > windowStart) {
        // Round up to next 15-minute interval
        const minutes = currentTime.getMinutes()
        const roundedMinutes = Math.ceil(minutes / 15) * 15
        currentTime.setMinutes(roundedMinutes, 0, 0)

        if (currentTime > windowStart) {
          currentSlot = currentTime
        }
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
