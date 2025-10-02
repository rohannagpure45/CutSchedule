import { format, addMinutes, addDays, addWeeks, subWeeks, startOfDay, endOfDay, isAfter, isBefore, parseISO } from 'date-fns'

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm')
}

export function formatDateTime(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss')
}

export function parseTime(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

export function combineDateTime(dateString: string, timeString: string): Date {
  // Parse the date string as YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number)
  const [hours, minutes] = timeString.split(':').map(Number)

  // Create date in local timezone to match user's timezone
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0)
  return date
}

export function getAvailableTimeSlots(
  date: Date,
  workingHours: { startTime: string; endTime: string },
  existingAppointments: Array<{ startTime: Date; endTime: Date }>,
  appointmentDuration: number = 45,
  bufferTime: number = 30
): string[] {
  const slots: string[] = []
  const startTime = parseTime(workingHours.startTime)
  const endTime = parseTime(workingHours.endTime)

  // Generate 15-minute intervals
  for (let time = startTime; time < endTime; time = addMinutes(time, 15)) {
    const slotEnd = addMinutes(time, appointmentDuration)

    // Check if slot + buffer time are free
    const isAvailable = !existingAppointments.some(apt => {
      const aptStart = apt.startTime
      const aptEnd = addMinutes(apt.endTime, bufferTime)

      return (
        (time >= aptStart && time < aptEnd) ||
        (slotEnd > aptStart && slotEnd <= aptEnd) ||
        (time < aptStart && slotEnd > aptEnd)
      )
    })

    if (isAvailable && slotEnd <= endTime) {
      slots.push(formatTime(time))
    }
  }

  return slots
}

export function isTimeSlotAvailable(
  startTime: Date,
  endTime: Date,
  existingAppointments: Array<{ startTime: Date; endTime: Date }>,
  bufferTime: number = 30
): boolean {
  return !existingAppointments.some(apt => {
    const aptStart = apt.startTime
    const aptEnd = addMinutes(apt.endTime, bufferTime)

    return (
      (startTime >= aptStart && startTime < aptEnd) ||
      (endTime > aptStart && endTime <= aptEnd) ||
      (startTime < aptStart && endTime > aptEnd)
    )
  })
}

export function getNextAvailableDate(
  workingHours: Array<{ dayOfWeek: number; isActive: boolean }>,
  maxDays: number = 30
): Date | null {
  const today = new Date()

  for (let i = 0; i < maxDays; i++) {
    const date = addDays(today, i)
    const dayOfWeek = date.getDay()
    const workingDay = workingHours.find(wh => wh.dayOfWeek === dayOfWeek)

    if (workingDay?.isActive) {
      return date
    }
  }

  return null
}

export { addMinutes, addDays, addWeeks, subWeeks, startOfDay, endOfDay, isAfter, isBefore, parseISO }