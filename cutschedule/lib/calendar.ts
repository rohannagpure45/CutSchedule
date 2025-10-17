import { google } from 'googleapis'
import { prisma } from '@/lib/db'

function getCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || 'primary'
}

// Initialize Google Calendar API with OAuth2 client
async function getGoogleCalendarClient(userEmail?: string) {
  try {
    // Get the user's account with OAuth tokens
    // If no email provided, get the most recent Google account
    const whereClause = userEmail
      ? {
          provider: 'google',
          user: {
            email: userEmail,
          },
        }
      : {
          provider: 'google',
        }

    const account = await prisma.account.findFirst({
      where: whereClause,
      include: {
        user: true,
      },
      orderBy: {
        id: 'desc', // Get the most recent account
      },
    })

    if (!account || !account.access_token) {
      const errorMessage = !account
        ? `No Google account found${userEmail ? ` for ${userEmail}` : ''}. User must sign in with Google first.`
        : 'Google account found but missing access token'
      console.error('Calendar client initialization failed:', errorMessage)
      throw new Error(errorMessage)
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )

    // Set credentials
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    })

    // Auto-refresh token if needed; persist any updated fields
    oauth2Client.on('tokens', async (tokens) => {
      try {
        const data: any = {}
        if (typeof tokens.refresh_token === 'string') {
          data.refresh_token = tokens.refresh_token
        }
        if (typeof tokens.access_token === 'string') {
          data.access_token = tokens.access_token
        }
        if (typeof tokens.expiry_date === 'number') {
          data.expires_at = Math.floor(tokens.expiry_date / 1000)
        }

        if (Object.keys(data).length > 0) {
          await prisma.account.update({
            where: { id: account.id },
            data,
          })
        }
      } catch (e) {
        console.error('Failed to persist refreshed Google tokens:', e)
      }
    })

    return google.calendar({ version: 'v3', auth: oauth2Client })
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error)
    throw error
  }
}

function getDefaultCalendarOwnerEmail(): string | undefined {
  return process.env.GOOGLE_CALENDAR_OWNER_EMAIL || process.env.ADMIN_EMAIL || undefined
}

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees?: Array<{
    email?: string
    displayName?: string
  }>
  reminders?: {
    useDefault: boolean
    overrides?: Array<{
      method: string
      minutes: number
    }>
  }
}

export async function createCalendarEvent(
  appointment: {
    id: string
    clientName: string
    phoneNumber: string
    startTime: Date
    endTime: Date
  },
  userEmail?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userEmail || getDefaultCalendarOwnerEmail())

    // Ensure we never fall back to any placeholder names from auth/session
    const clientName = (appointment.clientName || '').trim() || 'Client'

    const event: CalendarEvent = {
      summary: `Haircut - ${clientName}`,
      description: `Haircut appointment for ${clientName}\nPhone: ${appointment.phoneNumber}\nAppointment ID: ${appointment.id}`,
      start: {
        dateTime: appointment.startTime.toISOString(),
        timeZone: 'America/New_York', // Adjust timezone as needed
      },
      end: {
        dateTime: appointment.endTime.toISOString(),
        timeZone: 'America/New_York',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 }
        ]
      }
    }

    console.log('Creating calendar event:', event)

    const response = await calendar.events.insert({
      calendarId: getCalendarId(),
      requestBody: event,
    })

    console.log('Calendar event created successfully:', response.data.id)

    return {
      success: true,
      eventId: response.data.id!
    }

  } catch (error: any) {
    console.error('Error creating calendar event:', error)
    return {
      success: false,
      error: error.message || 'Failed to create calendar event'
    }
  }
}

export async function updateCalendarEvent(
  eventId: string,
  appointment: {
    id: string
    clientName: string
    phoneNumber: string
    startTime: Date
    endTime: Date
  },
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userEmail || getDefaultCalendarOwnerEmail())

    const clientName = (appointment.clientName || '').trim() || 'Client'

    const event: CalendarEvent = {
      summary: `Haircut - ${clientName}`,
      description: `Haircut appointment for ${clientName}\nPhone: ${appointment.phoneNumber}\nAppointment ID: ${appointment.id}`,
      start: {
        dateTime: appointment.startTime.toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: appointment.endTime.toISOString(),
        timeZone: 'America/New_York',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 }
        ]
      }
    }

    console.log('Updating calendar event:', eventId, event)

    await calendar.events.update({
      calendarId: getCalendarId(),
      eventId: eventId,
      requestBody: event,
    })

    console.log('Calendar event updated successfully:', eventId)

    return { success: true }

  } catch (error: any) {
    console.error('Error updating calendar event:', error)
    return {
      success: false,
      error: error.message || 'Failed to update calendar event'
    }
  }
}

export async function deleteCalendarEvent(
  eventId: string,
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const tryDelete = async (email?: string) => {
    const calendar = await getGoogleCalendarClient(email)
    await calendar.events.delete({ calendarId: getCalendarId(), eventId })
  }

  try {
    console.log('Deleting calendar event:', eventId)
    // First try with provided email (if any)
    await tryDelete(userEmail)
    console.log('Calendar event deleted successfully:', eventId)
    return { success: true }
  } catch (primaryError: any) {
    // Try with default owner email if provided email failed
    try {
      const fallbackEmail = getDefaultCalendarOwnerEmail()
      if (fallbackEmail && fallbackEmail !== userEmail) {
        console.warn('Primary delete failed. Retrying with fallback calendar owner email.')
        await tryDelete(fallbackEmail)
        console.log('Calendar event deleted successfully (fallback):', eventId)
        return { success: true }
      }
      throw primaryError
    } catch (error: any) {
      console.error('Error deleting calendar event:', error)
      return { success: false, error: error?.message || 'Failed to delete calendar event' }
    }
  }
}

export async function getCalendarEvents(
  timeMin: Date,
  timeMax: Date,
  userEmail?: string
): Promise<{ success: boolean; events?: any[]; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userEmail)

    console.log('Fetching calendar events from', timeMin, 'to', timeMax)

    const response = await calendar.events.list({
      calendarId: getCalendarId(),
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    console.log('Fetched', response.data.items?.length || 0, 'calendar events')

    return {
      success: true,
      events: response.data.items || []
    }

  } catch (error: any) {
    console.error('Error fetching calendar events:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch calendar events'
    }
  }
}
