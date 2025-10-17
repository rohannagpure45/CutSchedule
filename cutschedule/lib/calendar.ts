import { google, type calendar_v3 } from 'googleapis'
import type { GaxiosError } from 'gaxios'
import { formatInTimeZone } from 'date-fns-tz'
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

    // Create OAuth2 client without redirect URI to avoid invalid_grant due to env mismatch
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
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

    const client = google.calendar({ version: 'v3', auth: oauth2Client })
    try {
      console.log('[Calendar] Initialized client', {
        email: account.user?.email,
        calendarId: getCalendarId(),
      })
    } catch (err) {
      // Ensure logging failures never crash or get silently swallowed
      try {
        console.error('Calendar logging failed', err)
      } catch {
        // Last-resort fallback
        try { process?.stderr?.write?.('Calendar logging failed\n') } catch {}
      }
    }
    return client
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error)
    throw error
  }
}

function getDefaultCalendarOwnerEmail(): string | undefined {
  return process.env.GOOGLE_CALENDAR_OWNER_EMAIL || process.env.ADMIN_EMAIL || undefined
}

async function getCalendarClientWithFallback(userEmail?: string) {
  // Prefer service account if configured
  const svc = await getServiceCalendarClientIfAvailable()
  if (svc) return svc
  const firstAttemptEmail = userEmail ?? getDefaultCalendarOwnerEmail()
  try {
    return await getGoogleCalendarClient(firstAttemptEmail)
  } catch (e1) {
    console.warn('Primary calendar client initialization failed', { firstAttemptEmail }, e1)
    const fallbackEmail = getDefaultCalendarOwnerEmail()
    if (fallbackEmail && fallbackEmail !== firstAttemptEmail) {
      try {
        return await getGoogleCalendarClient(fallbackEmail)
      } catch (e2) {
        console.warn('Fallback calendar client initialization failed', { fallbackEmail }, e2)
      }
    }
    console.warn('Falling back to most-recent Google account for calendar client')
    return await getGoogleCalendarClient(undefined)
  }
}

// Secure secret retrieval for a fallback refresh token (no direct env access)
async function getRefreshTokenSecret(): Promise<string | undefined> {
  const backend = (process.env.CALENDAR_SECRET_BACKEND || 'prisma').toLowerCase()
  try {
    if (backend === 'prisma') {
      const owner = getDefaultCalendarOwnerEmail()
      if (!owner) return undefined
      const account = await prisma.account.findFirst({
        where: { provider: 'google', user: { email: owner } },
        include: { user: true },
        orderBy: { id: 'desc' },
      })
      // If stored encrypted, decrypt here (placeholder)
      return account?.refresh_token || undefined
    }
    // TODO: Add AWS Secrets Manager / Vault integrations when configured
    return undefined
  } catch (err) {
    console.error('[Calendar] Failed to retrieve fallback refresh token from backend', err)
    return undefined
  }
}

async function getSecretCalendarClient() {
  const refresh = await getRefreshTokenSecret()
  if (!refresh) return undefined
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ refresh_token: refresh })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

// Generic helper to retry calendar operations with env refresh token on invalid_grant
async function withEnvTokenRetry<T>(
  operation: (calendar?: calendar_v3.Calendar) => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await operation(undefined)
  } catch (error) {
    const gerr = error as GaxiosError<{ error?: string }>
    const isInvalidGrant = gerr?.response?.status === 400 && gerr?.response?.data?.error === 'invalid_grant'
    if (isInvalidGrant) {
      console.warn(`[Calendar] invalid_grant on ${operationName}; attempting secure token retry`)
      try {
        const envCal = await getSecretCalendarClient()
        if (envCal) {
          return await operation(envCal)
        }
      } catch (e2) {
        console.error(`[Calendar] Retry with secure token failed while ${operationName}:`, e2)
        throw error
      }
    }
    throw error
  }
}

function hasServiceAccount(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
}

async function getServiceCalendarClientIfAvailable() {
  if (!hasServiceAccount()) return undefined
  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL as string
    // Support env with escaped newlines
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY as string).replace(/\\n/g, '\n')
    const jwt = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    })
    await jwt.authorize()
    const cal = google.calendar({ version: 'v3', auth: jwt })
    console.log('[Calendar] Using service account client', { email: clientEmail, calendarId: getCalendarId() })
    return cal
  } catch (e) {
    console.warn('[Calendar] Service account initialization failed; falling back to OAuth user', e)
    return undefined
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

export type AppointmentForCalendar = {
  id: string
  clientName: string
  phoneNumber: string
  startTime: Date
  endTime: Date
  timeZone?: string
}

function buildHaircutEvent(appointment: AppointmentForCalendar): CalendarEvent {
  const clientName = (appointment.clientName || '').trim() || 'Client'
  const tz = appointment.timeZone || process.env.DEFAULT_TIMEZONE || 'America/New_York'
  // Build RFC3339 strings in the target timezone with offset
  const startLocal = formatInTimeZone(appointment.startTime, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
  const endLocal = formatInTimeZone(appointment.endTime, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
  return {
    summary: `Haircut - ${clientName}`,
    description: `Haircut appointment for ${clientName}\nPhone: ${appointment.phoneNumber}\nAppointment ID: ${appointment.id}`,
    start: {
      dateTime: startLocal,
      timeZone: tz,
    },
    end: {
      dateTime: endLocal,
      timeZone: tz,
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 10 }],
    },
  }
}

export async function createCalendarEvent(
  appointment: AppointmentForCalendar,
  userEmail?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const result = await withEnvTokenRetry(async (cal?: calendar_v3.Calendar) => {
      const calendar = cal ?? await getCalendarClientWithFallback(userEmail)
      const event = buildHaircutEvent(appointment)
      console.log('[Calendar] Creating event on', getCalendarId(), '→', { summary: event.summary, start: event.start, end: event.end })
      const response = await calendar.events.insert({ calendarId: getCalendarId(), requestBody: event })
      console.log('[Calendar] Created event id:', response.data.id)
      return { success: true as const, eventId: response.data.id! }
    }, 'creating event')
    return result
  } catch (error: any) {
    const gerr = error as GaxiosError<{ error?: string }>
    const isInvalidGrant = gerr?.response?.status === 400 && gerr?.response?.data?.error === 'invalid_grant'
    if (isInvalidGrant) {
      console.error('[Calendar] invalid_grant while creating event. The Google refresh token may be invalid or revoked. Ask the owner to re-authenticate in Admin.', error)
    } else {
      console.error('Error creating calendar event:', error)
    }
    return { success: false, error: error?.message || 'Failed to create calendar event' }
  }
}

export async function updateCalendarEvent(
  eventId: string,
  appointment: AppointmentForCalendar,
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await withEnvTokenRetry(async (cal?: calendar_v3.Calendar) => {
      const calendar = cal ?? await getCalendarClientWithFallback(userEmail)
      const event = buildHaircutEvent(appointment)
      console.log('[Calendar] Updating event on', getCalendarId(), 'id:', eventId, '→', { summary: event.summary, start: event.start, end: event.end })
      await calendar.events.update({ calendarId: getCalendarId(), eventId, requestBody: event })
      console.log('[Calendar] Updated event id:', eventId)
      return { success: true as const }
    }, 'updating event')
    return result
  } catch (error: any) {
    const gerr = error as GaxiosError<{ error?: string }>
    const isInvalidGrant = gerr?.response?.status === 400 && gerr?.response?.data?.error === 'invalid_grant'
    if (isInvalidGrant) {
      console.error('[Calendar] invalid_grant while updating event. The Google refresh token may be invalid or revoked. Ask the owner to re-authenticate in Admin.', error)
    } else {
      console.error('Error updating calendar event:', error)
    }
    return { success: false, error: error?.message || 'Failed to update calendar event' }
  }
}

export async function deleteCalendarEvent(
  eventId: string,
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const tryDelete = async (email?: string) => {
    await withEnvTokenRetry(async (cal?: calendar_v3.Calendar) => {
      const calendar = cal ?? await getCalendarClientWithFallback(email)
      console.log('[Calendar] Deleting event on', getCalendarId(), 'with email', email)
      await calendar.events.delete({ calendarId: getCalendarId(), eventId })
      return true as const
    }, 'deleting event')
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
    const calendar = await getCalendarClientWithFallback(userEmail)

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
