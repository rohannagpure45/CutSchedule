export const APP_CONFIG = {
  APPOINTMENT_DURATION: 45, // minutes
  BUFFER_TIME: 30, // minutes between appointments
  SLOT_INTERVAL: 15, // minute intervals for time slots
  MAX_ADVANCE_BOOKING_DAYS: parseInt(process.env.MAX_ADVANCE_DAYS || '25'),
  BARBER_NAME: process.env.BARBER_NAME || 'CutSchedule Barbershop',
  BARBER_ADDRESS: process.env.BARBER_ADDRESS || '123 Main St, City, State 12345',
  BARBER_PHONE: process.env.BARBER_PHONE || '+1234567890',
  BOOKING_URL: process.env.BOOKING_URL || 'http://localhost:3001',
} as const

export const APPOINTMENT_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const

export const SMS_MESSAGE_TYPES = {
  CONFIRMATION: 'confirmation',
  REMINDER_1DAY: 'reminder_1day',
  REMINDER_1HOUR: 'reminder_1hour',
  RESCHEDULE_2WEEKS: 'reschedule_2weeks',
  RESCHEDULE_3WEEKS: 'reschedule_3weeks',
} as const

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const DEFAULT_WORKING_HOURS = {
  MONDAY: { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isActive: true },
  TUESDAY: { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isActive: true },
  WEDNESDAY: { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isActive: true },
  THURSDAY: { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isActive: true },
  FRIDAY: { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isActive: true },
  SATURDAY: { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isActive: true },
  SUNDAY: { dayOfWeek: 0, startTime: '10:00', endTime: '16:00', isActive: false },
} as const

export const SMS_TEMPLATES = {
  CONFIRMATION: (name: string, date: string, time: string, cancelLink: string) =>
    `Hi ${name}! Your haircut is confirmed for ${date} at ${time}.\n\nAddress: ${APP_CONFIG.BARBER_ADDRESS}\nPhone: ${APP_CONFIG.BARBER_PHONE}\n\nTo reschedule or cancel: ${cancelLink}\n\nReply STOP to unsubscribe.`,

  REMINDER_1DAY: (name: string, date: string, time: string, cancelLink: string) =>
    `Reminder: Your haircut is tomorrow (${date}) at ${time}.\n\nAddress: ${APP_CONFIG.BARBER_ADDRESS}\n\nTo reschedule or cancel: ${cancelLink}`,

  REMINDER_1HOUR: (name: string, time: string) =>
    `Your haircut is in 1 hour at ${time} today!\n\nAddress: ${APP_CONFIG.BARBER_ADDRESS}\n\nSee you soon!`,

  RESCHEDULE_2WEEKS: (name: string, bookingLink: string) =>
    `Hi ${name}! It's been 2 weeks since your last haircut. Ready for a fresh cut?\n\nBook your next appointment: ${bookingLink}\n\nReply STOP to unsubscribe.`,

  RESCHEDULE_3WEEKS: (name: string, bookingLink: string) =>
    `Hi ${name}! Time for a trim? Book your next haircut: ${bookingLink}\n\nReply STOP to unsubscribe.`,
} as const

export type AppointmentStatus = typeof APPOINTMENT_STATUS[keyof typeof APPOINTMENT_STATUS]
export type SMSMessageType = typeof SMS_MESSAGE_TYPES[keyof typeof SMS_MESSAGE_TYPES]
export type DayOfWeek = typeof DAYS_OF_WEEK[number]