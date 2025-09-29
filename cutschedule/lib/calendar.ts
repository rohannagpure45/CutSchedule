import { google } from 'googleapis'

// Initialize Google Calendar API
function getGoogleCalendarClient() {
  try {
    const credentials = {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar']
    })

    return google.calendar({ version: 'v3', auth })
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
    const calendar = getGoogleCalendarClient()

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
    const calendar = getGoogleCalendarClient()

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
    const calendar = getGoogleCalendarClient()

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
    const calendar = getGoogleCalendarClient()

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