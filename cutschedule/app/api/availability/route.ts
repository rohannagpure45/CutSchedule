import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { startOfDay, endOfDay, format, parse, addMinutes, isWithinInterval } from 'date-fns'
import { availabilityQuerySchema } from '@/lib/utils/validation'
import { APP_CONFIG } from '@/lib/constants'

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
    const date = new Date(validatedQuery.date)
    const dayOfWeek = date.getDay()

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

    // Get working hours for this day
    const workingHours = await prisma.workingHours.findUnique({
      where: {
        dayOfWeek: dayOfWeek,
      },
    })

    if (!workingHours || !workingHours.isActive) {
      return NextResponse.json({
        available: false,
        slots: [],
        reason: 'Closed on this day'
      })
    }

    // Get all confirmed appointments for this date
    const appointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: {
          not: 'cancelled',
        },
      },
      select: {
        startTime: true,
        endTime: true,
      }
    })

    // Generate available time slots
    const slots = generateAvailableSlots(
      workingHours.startTime,
      workingHours.endTime,
      appointments,
      date
    )

    return NextResponse.json({
      available: slots.length > 0,
      slots,
      workingHours: {
        start: workingHours.startTime,
        end: workingHours.endTime,
      },
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
  startTime: string,
  endTime: string,
  appointments: Array<{ startTime: Date; endTime: Date }>,
  targetDate: Date
): string[] {
  const slots: string[] = []

  // Create base date for time parsing
  const baseDate = new Date(targetDate)
  baseDate.setHours(0, 0, 0, 0)

  // Parse working hours
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)

  const workStart = new Date(baseDate)
  workStart.setHours(startHour, startMinute, 0, 0)

  const workEnd = new Date(baseDate)
  workEnd.setHours(endHour, endMinute, 0, 0)

  // If it's today, start from current time (rounded up to next 15-min interval)
  let currentSlot = new Date(workStart)
  const now = new Date()

  if (targetDate.toDateString() === now.toDateString()) {
    const currentTime = new Date(baseDate)
    currentTime.setHours(now.getHours(), now.getMinutes(), 0, 0)

    if (currentTime > workStart) {
      // Round up to next 15-minute interval
      const minutes = currentTime.getMinutes()
      const roundedMinutes = Math.ceil(minutes / 15) * 15
      currentTime.setMinutes(roundedMinutes, 0, 0)

      if (currentTime > workStart) {
        currentSlot = currentTime
      }
    }
  }

  // Generate slots every 15 minutes
  while (currentSlot < workEnd) {
    const slotEnd = addMinutes(currentSlot, APP_CONFIG.APPOINTMENT_DURATION)

    // Check if slot would extend beyond working hours
    if (slotEnd > workEnd) {
      break
    }

    // Check if this slot conflicts with any appointment (including buffer)
    const isBlocked = appointments.some(apt => {
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

    if (!isBlocked) {
      slots.push(format(currentSlot, 'HH:mm'))
    }

    currentSlot = addMinutes(currentSlot, APP_CONFIG.SLOT_INTERVAL)
  }

  return slots
}