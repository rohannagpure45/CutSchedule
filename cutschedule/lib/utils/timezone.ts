export const BUSINESS_TIME_ZONE = 'America/New_York'

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input)
}

export function formatETDateShort(input: string | Date): string {
  const d = toDate(input)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function formatETDateLong(input: string | Date): string {
  const d = toDate(input)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function formatETTime(input: string | Date): string {
  const d = toDate(input)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

export function formatETDateTimeShort(input: string | Date): string {
  const d = toDate(input)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

export function etDateKey(input: string | Date): string {
  const d = toDate(input)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${day}`
}

export function isETToday(input: string | Date): boolean {
  const nowKey = etDateKey(new Date())
  const dateKey = etDateKey(input)
  return dateKey === nowKey
}

export function isETTomorrow(input: string | Date): boolean {
  // Derive "tomorrow" by getting the ET date parts for today and incrementing one day
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = Number(parts.find(p => p.type === 'year')?.value || '0')
  const m = Number(parts.find(p => p.type === 'month')?.value || '1')
  const d = Number(parts.find(p => p.type === 'day')?.value || '1')
  // Create a date using the ET calendar day, then add 1 day
  const tomorrowLocal = new Date(y, m - 1, d + 1)
  const tomorrowKey = etDateKey(tomorrowLocal)
  return etDateKey(input) === tomorrowKey
}

export function etDaysFromToday(input: string | Date): number {
  const key = etDateKey(input)
  const today = etDateKey(new Date())
  const [y1, m1, d1] = today.split('-').map(Number)
  const [y2, m2, d2] = key.split('-').map(Number)
  const base = new Date(y1, m1 - 1, d1)
  const target = new Date(y2, m2 - 1, d2)
  const diffMs = target.getTime() - base.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}
