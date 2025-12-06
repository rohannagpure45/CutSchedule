import { z } from 'zod'

// Phone number validation (US format)
const phoneRegex = /^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/

export const phoneNumberSchema = z
  .string()
  .regex(phoneRegex, 'Please enter a valid phone number')
  .transform(phone => {
    // Normalize phone number to +1XXXXXXXXXX format
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) {
      return `+1${digits}`
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    return phone
  })

export const appointmentBookingSchema = z.object({
  clientName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  phoneNumber: phoneNumberSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
})

export const appointmentUpdateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .optional(),
  status: z
    .enum(['confirmed', 'cancelled', 'completed'])
    .optional(),
})

export const workingHoursSchema = z.object({
  dayOfWeek: z
    .number()
    .min(0, 'Day of week must be between 0-6')
    .max(6, 'Day of week must be between 0-6'),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'End time must be in HH:MM format'),
  isActive: z.boolean().default(true),
})

export const availabilityQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
})

export const smsMessageSchema = z.object({
  phoneNumber: phoneNumberSchema,
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(160, 'Message must be less than 160 characters'),
  messageType: z.enum([
    'confirmation',
    'reminder_1day',
    'reminder_1hour',
    'reschedule_2weeks',
    'reschedule_3weeks',
  ]),
})

export const adminLoginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address'),
})

// Types derived from schemas
export type AppointmentBookingData = z.infer<typeof appointmentBookingSchema>
export type AppointmentUpdateData = z.infer<typeof appointmentUpdateSchema>
export type WorkingHoursData = z.infer<typeof workingHoursSchema>
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>
export type SMSMessageData = z.infer<typeof smsMessageSchema>
export type AdminLoginData = z.infer<typeof adminLoginSchema>

// Validation functions
export function validatePhoneNumber(phone: string): boolean {
  try {
    phoneNumberSchema.parse(phone)
    return true
  } catch {
    return false
  }
}

export function normalizePhoneNumber(phone: string): string {
  try {
    return phoneNumberSchema.parse(phone)
  } catch {
    return phone
  }
}

// Mask phone number to protect PII: "1234567890" -> "***-***-7890"
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return ''
  return `***-***-${digits.slice(-4)}`
}

export function validateAppointmentTime(date: string, time: string): boolean {
  const appointmentDate = new Date(`${date}T${time}:00`)
  const now = new Date()

  // Cannot book appointments in the past
  if (appointmentDate <= now) {
    return false
  }

  // Cannot book more than MAX_ADVANCE_DAYS in advance
  const maxAdvanceDays = parseInt(process.env.MAX_ADVANCE_DAYS || '25')
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + maxAdvanceDays)

  if (appointmentDate > maxDate) {
    return false
  }

  return true
}