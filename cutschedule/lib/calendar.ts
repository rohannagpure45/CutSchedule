import { google } from 'googleapis'
import { prisma } from '@/lib/db'

// Initialize Google Calendar API with OAuth2 client
async function getGoogleCalendarClient() {
  try {
    // Get the admin's account with OAuth tokens
    // Must join with User table to ensure we get the correct admin account
    const account = await prisma.account.findFirst({
      where: {
        provider: 'google',
        user: {
          email: process.env.ADMIN_EMAIL,
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        id: 'desc', // Get the most recent account for this admin
      },
    })

    if (!account || !account.access_token) {
      const errorMessage = !account
        ? `No Google account found for admin (${process.env.ADMIN_EMAIL}). Admin must sign in with Google first.`
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

    // Auto-refresh token if needed
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        // Update the refresh token in database
        await prisma.account.update({
          where: { id: account.id },
          data: {
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
            expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
          },
        })
      }
    })

    return google.calendar({ version: 'v3', auth: oauth2Client })
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error)
    throw error
  }
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
  }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient()

    const event: CalendarEvent = {
      summary: `Haircut - ${appointment.clientName}`,
      description: `Haircut appointment for ${appointment.clientName}\nPhone: ${appointment.phoneNumber}\nAppointment ID: ${appointment.id}`,
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
      calendarId: 'primary', // Use 'primary' for the default calendar
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
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient()

    const event: CalendarEvent = {
      summary: `Haircut - ${appointment.clientName}`,
      description: `Haircut appointment for ${appointment.clientName}\nPhone: ${appointment.phoneNumber}\nAppointment ID: ${appointment.id}`,
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
      calendarId: 'primary',
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
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient()

    console.log('Deleting calendar event:', eventId)

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    })

    console.log('Calendar event deleted successfully:', eventId)

    return { success: true }

  } catch (error: any) {
    console.error('Error deleting calendar event:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete calendar event'
    }
  }
}

export async function getCalendarEvents(
  timeMin: Date,
  timeMax: Date
): Promise<{ success: boolean; events?: any[]; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient()

    console.log('Fetching calendar events from', timeMin, 'to', timeMax)

    const response = await calendar.events.list({
      calendarId: 'primary',
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