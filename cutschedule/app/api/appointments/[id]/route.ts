import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { appointmentUpdateSchema } from '@/lib/utils/validation'
import { combineDateTime, parseDateInLocalTimezone } from '@/lib/utils/dates'
import { addMinutes } from 'date-fns'
import { APP_CONFIG } from '@/lib/constants'
import { sendCancellationSMS, sendConfirmationSMS } from '@/lib/sms'
import { deleteCalendarEvent, createCalendarEvent } from '@/lib/calendar'
import { getBusinessDayRange } from '@/lib/utils/dates'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error fetching appointment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointment' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = appointmentUpdateSchema.parse(body)

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // If only updating status
    if (validatedData.status && !validatedData.date && !validatedData.time) {
      const updatedAppointment = await prisma.appointment.update({
        where: { id },
        data: { status: validatedData.status },
      })

      return NextResponse.json(updatedAppointment)
    }

    // If rescheduling (updating date/time)
    if (validatedData.date && validatedData.time) {
      const newDate = parseDateInLocalTimezone(validatedData.date)
      const newStartTime = combineDateTime(validatedData.date, validatedData.time)
      const newEndTime = addMinutes(newStartTime, APP_CONFIG.APPOINTMENT_DURATION)

      // Check if new time is in the future
      if (newStartTime <= new Date()) {
        return NextResponse.json(
          { error: 'Cannot reschedule to a past time' },
          { status: 400 }
        )
      }

      // Check working hours for new date
      const dayOfWeek = newDate.getDay()
      const workingHours = await prisma.workingHours.findUnique({
        where: { dayOfWeek },
      })

      if (!workingHours || !workingHours.isActive) {
        return NextResponse.json(
          { error: 'Selected day is not available for appointments' },
          { status: 400 }
        )
      }

      // Check for conflicts (excluding current appointment, only check confirmed)
      const { start: dayStart, endExclusive: dayEnd } = getBusinessDayRange(newDate)
      const conflictingAppointments = await prisma.appointment.findMany({
        where: {
          id: { not: id }, // Exclude current appointment
          date: {
            gte: dayStart,
            lt: dayEnd,
          },
          status: 'confirmed',
          OR: [
            {
              startTime: {
                lt: addMinutes(newEndTime, APP_CONFIG.BUFFER_TIME),
                gte: newStartTime,
              },
            },
            {
              endTime: {
                gt: newStartTime,
                lte: addMinutes(newEndTime, APP_CONFIG.BUFFER_TIME),
              },
            },
            {
              startTime: { lte: newStartTime },
              endTime: { gte: addMinutes(newEndTime, APP_CONFIG.BUFFER_TIME) },
            },
          ],
        },
      })

      if (conflictingAppointments.length > 0) {
        return NextResponse.json(
          { error: 'Selected time slot is not available' },
          { status: 400 }
        )
      }

      // Update appointment
      const updatedAppointment = await prisma.appointment.update({
        where: { id },
        data: {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          status: validatedData.status || appointment.status,
        },
      })

      // Replace Google Calendar event: delete old event (if any) then create a new one
      try {
        if (appointment.googleEventId) {
          const delResult = await deleteCalendarEvent(appointment.googleEventId)
          if (delResult.success) {
            console.log('Deleted old calendar event:', appointment.googleEventId)
          } else {
            console.warn('Failed to delete old calendar event:', delResult.error)
          }
        }

        const createResult = await createCalendarEvent({
          id: updatedAppointment.id,
          clientName: updatedAppointment.clientName,
          phoneNumber: updatedAppointment.phoneNumber,
          startTime: newStartTime,
          endTime: newEndTime,
        })

        if (createResult.success && createResult.eventId) {
          await prisma.appointment.update({
            where: { id: updatedAppointment.id },
            data: { googleEventId: createResult.eventId },
          })
          console.log('Created new calendar event:', createResult.eventId)
        } else {
          console.error('Failed to create new calendar event:', createResult.error)
          // If creation failed, clear googleEventId since old one may be deleted
          await prisma.appointment.update({
            where: { id: updatedAppointment.id },
            data: { googleEventId: null },
          })
        }
      } catch (error) {
        console.error('Error replacing calendar event during reschedule:', error)
        // Best-effort: clear googleEventId if we deleted the old event
        await prisma.appointment.update({
          where: { id: updatedAppointment.id },
          data: { googleEventId: null },
        })
      }

      // Send reschedule confirmation SMS
      try {
        const smsResult = await sendConfirmationSMS(updatedAppointment)
        if (smsResult.success) {
          console.log('Reschedule confirmation SMS sent successfully:', smsResult.messageId)
        } else {
          console.error('Failed to send reschedule confirmation SMS:', smsResult.error)
        }
      } catch (error) {
        console.error('Error sending reschedule confirmation SMS:', error)
        // Don't fail the reschedule if SMS fails
      }

      return NextResponse.json(updatedAppointment)
    }

    // If only updating other fields
    const updateData: any = {}
    if (validatedData.status) updateData.status = validatedData.status

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updatedAppointment)

  } catch (error) {
    console.error('Error updating appointment:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input data', details: (error as any).errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update appointment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Mark as cancelled instead of deleting
    const cancelledAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    // Send cancellation SMS
    try {
      const smsResult = await sendCancellationSMS(appointment)
      if (smsResult.success) {
        console.log('Cancellation SMS sent successfully:', smsResult.messageId)
      } else {
        console.error('Failed to send cancellation SMS:', smsResult.error)
      }
    } catch (error) {
      console.error('Error sending cancellation SMS:', error)
      // Don't fail the cancellation if SMS fails
    }

    // Delete Google Calendar event
    if (appointment.googleEventId) {
      try {
        const calendarResult = await deleteCalendarEvent(appointment.googleEventId)
        if (calendarResult.success) {
          console.log('Calendar event deleted successfully:', appointment.googleEventId)
          // Clear the googleEventId on the appointment record
          await prisma.appointment.update({
            where: { id },
            data: { googleEventId: null },
          })
        } else {
          console.error('Failed to delete calendar event:', calendarResult.error)
        }
      } catch (error) {
        console.error('Error deleting calendar event:', error)
        // Don't fail the cancellation if calendar deletion fails
      }
    }

    return NextResponse.json({
      message: 'Appointment cancelled successfully',
      appointment: cancelledAppointment
    })

  } catch (error) {
    console.error('Error cancelling appointment:', error)
    return NextResponse.json(
      { error: 'Failed to cancel appointment' },
      { status: 500 }
    )
  }
}
