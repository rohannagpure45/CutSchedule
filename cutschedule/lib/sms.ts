import { prisma } from '@/lib/db'

const twilio = require('twilio')
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// Format phone number to E.164 format (+1XXXXXXXXXX)
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '')

  // Valid US phone number formats
  if (cleaned.length === 10) {
    // US number without country code
    return `+1${cleaned}`
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // US number with country code
    return `+${cleaned}`
  }

  // All other cases are invalid
  // Log detailed warning with both original input and cleaned digits
  console.warn(`Invalid phone number format: Original input="${phoneNumber}", Cleaned digits="${cleaned}" (${cleaned.length} digits)`)

  // Invalid cases include:
  // - Length < 10 digits
  // - Length > 11 digits
  // - Length === 11 but not starting with '1'

  // Return the original phoneNumber to not silently accept invalid inputs
  // Callers can check if the return value starts with '+' to validate success
  return phoneNumber
}

export interface SMSTemplate {
  confirmation: string
  reminder_1day: string
  reminder_1hour: string
  reschedule_2weeks: string
  reschedule_3weeks: string
  cancellation: string
}

const SMS_TEMPLATES: SMSTemplate = {
  confirmation: `Hi {clientName}! Your haircut appointment with Neil is confirmed for {date} at {time}. Located at 111 Gainsborough Street. To reschedule: https://cut-schedule-ck4d12342.vercel.app/manage-appointment/reschedule?id={appointmentId} Reply STOP to opt out.`,

  reminder_1day: `Hi {clientName}! Reminder: You have a haircut appointment tomorrow ({date}) at {time} with Neil at 111 Gainsborough Street. See you soon!`,

  reminder_1hour: `Hi {clientName}! Your haircut appointment with Neil starts in 1 hour at {time}. We're located at 111 Gainsborough Street. See you soon!`,

  reschedule_2weeks: `Hi {clientName}! It's been 2 weeks since your last haircut with Neil. Ready for another appointment? Book online at https://cut-schedule-ck4d12342.vercel.app or reply to this message.`,

  reschedule_3weeks: `Hi {clientName}! Ready for your next haircut? Book your appointment with Neil at https://cut-schedule-ck4d12342.vercel.app. We're here when you're ready!`,

  cancellation: `Hi {clientName}! Your haircut appointment for {date} at {time} has been cancelled. Book a new appointment anytime at https://cut-schedule-ck4d12342.vercel.app`
}

export interface SMSData {
  clientName: string
  date: string
  time: string
  appointmentId?: string
}

export async function sendSMS(
  phoneNumber: string,
  messageType: keyof SMSTemplate,
  data: SMSData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Format phone number to ensure consistency
    const formattedPhone = formatPhoneNumber(phoneNumber)

    // Get template and replace placeholders
    let message = SMS_TEMPLATES[messageType]
    message = message.replace('{clientName}', data.clientName)
    message = message.replace('{date}', data.date)
    message = message.replace('{time}', data.time)
    message = message.replace('{appointmentId}', data.appointmentId || '')

    console.log(`Sending ${messageType} SMS to ${formattedPhone} (original: ${phoneNumber}):`, message)

    // Send SMS via Twilio
    const twilioMessage = await client.messages.create({
      body: message,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: formattedPhone,
    })

    console.log('SMS sent successfully:', twilioMessage.sid)

    // Log SMS in database
    await logSMS(
      data.appointmentId || 'manual',
      phoneNumber,
      messageType,
      'sent',
      twilioMessage.sid
    )

    return {
      success: true,
      messageId: twilioMessage.sid
    }

  } catch (error: any) {
    console.error('Error sending SMS:', error)

    // Log failed SMS in database
    await logSMS(
      data.appointmentId || 'manual',
      phoneNumber,
      messageType,
      'failed'
    )

    return {
      success: false,
      error: error.message || 'Failed to send SMS'
    }
  }
}

export async function logSMS(
  appointmentId: string,
  phoneNumber: string,
  messageType: keyof SMSTemplate,
  status: 'sent' | 'failed',
  twilioSid?: string
) {
  try {
    await prisma.sMSLog.create({
      data: {
        appointmentId,
        phoneNumber,
        messageType,
        status,
        twilioSid: twilioSid || null,
      },
    })
    console.log(`SMS log created: ${messageType} to ${phoneNumber} - ${status}`)
  } catch (error) {
    console.error('Error logging SMS:', error)
  }
}

const BUSINESS_TZ = 'America/New_York'

export async function sendConfirmationSMS(
  appointment: {
    id: string
    clientName: string
    phoneNumber: string
    date: Date
    startTime: Date
  }
) {
  const formattedDate = appointment.startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })

  const formattedTime = appointment.startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: BUSINESS_TZ,
  })

  return await sendSMS(
    appointment.phoneNumber,
    'confirmation',
    {
      clientName: appointment.clientName,
      date: formattedDate,
      time: formattedTime,
      appointmentId: appointment.id,
    }
  )
}

export async function sendReminderSMS(
  appointment: {
    id: string
    clientName: string
    phoneNumber: string
    date: Date
    startTime: Date
  },
  reminderType: 'reminder_1day' | 'reminder_1hour'
) {
  const formattedDate = appointment.startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })

  const formattedTime = appointment.startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: BUSINESS_TZ,
  })

  return await sendSMS(
    appointment.phoneNumber,
    reminderType,
    {
      clientName: appointment.clientName,
      date: formattedDate,
      time: formattedTime,
      appointmentId: appointment.id,
    }
  )
}

export async function sendCancellationSMS(
  appointment: {
    id: string
    clientName: string
    phoneNumber: string
    date: Date
    startTime: Date
  }
) {
  const formattedDate = appointment.startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })

  const formattedTime = appointment.startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: BUSINESS_TZ,
  })

  return await sendSMS(
    appointment.phoneNumber,
    'cancellation',
    {
      clientName: appointment.clientName,
      date: formattedDate,
      time: formattedTime,
      appointmentId: appointment.id,
    }
  )
}
