import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { appointmentBookingSchema, normalizePhoneNumber } from '@/lib/utils/validation'
import { combineDateTime, parseDateInLocalTimezone } from '@/lib/utils/dates'
import { addMinutes, format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { BUSINESS_TIME_ZONE } from '@/lib/utils/timezone'
import { APP_CONFIG } from '@/lib/constants'
import { sendConfirmationSMS } from '@/lib/sms'
import { createCalendarEvent } from '@/lib/calendar'
import { getBusinessDayRange } from '@/lib/utils/dates'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const date = searchParams.get('date')
    const phoneNumber = searchParams.get('phone')

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (date) {
      const targetDate = parseDateInLocalTimezone(date)
      const { start, endExclusive } = getBusinessDayRange(targetDate)
      where.date = {
        gte: start,
        lt: endExclusive,
      }
    }

    if (phoneNumber) {
      where.phoneNumber = normalizePhoneNumber(phoneNumber)
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: {
        startTime: 'asc',
      },
    })

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received booking request:', body)

    // Validate input data
    const validatedData = appointmentBookingSchema.parse(body)
    console.log('Validated data:', validatedData)

    // Check if phone number already has an active appointment
    // Compute "now" as an instant aligned via business timezone to be explicit
    const now = new Date()
    const nowZoned = toZonedTime(now, BUSINESS_TIME_ZONE)
    const nowKey = format(nowZoned, "yyyy-MM-dd'T'HH:mm:ss.SSS")
    const nowETInstant = fromZonedTime(nowKey, BUSINESS_TIME_ZONE)

    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        phoneNumber: validatedData.phoneNumber,
        status: 'confirmed',
        startTime: {
          gte: nowETInstant,
        },
      },
    })

    if (existingAppointment) {
      return NextResponse.json(
        {
          error: 'You already have an upcoming appointment',
          existingAppointment: {
            id: existingAppointment.id,
            date: existingAppointment.date,
            startTime: existingAppointment.startTime,
          }
        },
        { status: 400 }
      )
    }

    // Parse date and time in local timezone to avoid UTC conversion issues
    const appointmentDate = parseDateInLocalTimezone(validatedData.date)
    const startTime = combineDateTime(validatedData.date, validatedData.time)
    const endTime = addMinutes(startTime, APP_CONFIG.APPOINTMENT_DURATION)

    console.log('Appointment timing:', {
      date: appointmentDate,
      startTime,
      endTime
    })

    // Verify the date has available slots configured
    const { start: dayStart, endExclusive: dayEnd } = getBusinessDayRange(appointmentDate)
    const availableSlots = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: dayStart,
          lt: dayEnd,
        }
      }
    })

    if (availableSlots.length === 0) {
      return NextResponse.json(
        { error: 'Selected day is not available for appointments' },
        { status: 400 }
      )
    }

    // Verify the selected time falls within an available slot window
    // and that the appointment duration fits within the window
    const requestedTime = validatedData.time // Format: "HH:mm"
    const [requestedHour, requestedMinute] = requestedTime.split(':').map(Number)

    const isWithinAvailableWindow = availableSlots.some(slot => {
      const [slotStartHour, slotStartMinute] = slot.startTime.split(':').map(Number)
      const [slotEndHour, slotEndMinute] = slot.endTime.split(':').map(Number)

      // Convert times to minutes since midnight for easier comparison
      const requestedMinutes = requestedHour * 60 + requestedMinute
      const slotStartMinutes = slotStartHour * 60 + slotStartMinute
      const slotEndMinutes = slotEndHour * 60 + slotEndMinute
      const appointmentEndMinutes = requestedMinutes + APP_CONFIG.APPOINTMENT_DURATION

      // Check if appointment starts within window AND ends before window closes
      return requestedMinutes >= slotStartMinutes && appointmentEndMinutes <= slotEndMinutes
    })

    if (!isWithinAvailableWindow) {
      return NextResponse.json(
        { error: 'Selected time is not within available hours' },
        { status: 400 }
      )
    }

    // Check for conflicting appointments (only confirmed ones block slots)
    const conflictingAppointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: dayStart,
          lt: dayEnd,
        },
        status: 'confirmed',
        OR: [
          {
            startTime: {
              lt: addMinutes(endTime, APP_CONFIG.BUFFER_TIME),
              gte: startTime,
            },
          },
          {
            endTime: {
              gt: startTime,
              lte: addMinutes(endTime, APP_CONFIG.BUFFER_TIME),
            },
          },
          {
            startTime: {
              lte: startTime,
            },
            endTime: {
              gte: addMinutes(endTime, APP_CONFIG.BUFFER_TIME),
            },
          },
        ],
      },
    })

    if (conflictingAppointments.length > 0) {
      return NextResponse.json(
        { error: 'Selected time slot is no longer available' },
        { status: 400 }
      )
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        clientName: validatedData.clientName,
        phoneNumber: validatedData.phoneNumber,
        date: appointmentDate,
        startTime,
        endTime,
        status: 'confirmed',
      },
    })

    console.log('Appointment created:', appointment)

    // Send confirmation SMS
    try {
      const smsResult = await sendConfirmationSMS(appointment)
      if (smsResult.success) {
        console.log('Confirmation SMS sent successfully:', smsResult.messageId)
      } else {
        console.error('Failed to send confirmation SMS:', smsResult.error)
      }
    } catch (error) {
      console.error('Error sending confirmation SMS:', error)
      // Don't fail the appointment creation if SMS fails
    }

    // Create Google Calendar event
    try {
      const ownerEmail = process.env.GOOGLE_CALENDAR_OWNER_EMAIL || process.env.ADMIN_EMAIL
      const calendarResult = await createCalendarEvent(appointment, ownerEmail)
      if (calendarResult.success && calendarResult.eventId) {
        console.log('Calendar event created successfully:', calendarResult.eventId)

        // Update appointment with Google Calendar event ID
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId: calendarResult.eventId },
        })
      } else {
        console.error('Failed to create calendar event:', calendarResult.error)
      }
    } catch (error) {
      console.error('Error creating calendar event:', error)
      // Don't fail the appointment creation if calendar event fails
    }

    return NextResponse.json(appointment, { status: 201 })

  } catch (error) {
    console.error('Error creating appointment:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        {
          error: 'Invalid input data',
          details: (error as any).errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    )
  }
}
