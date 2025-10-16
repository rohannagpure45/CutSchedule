import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns'
import { APP_CONFIG } from '@/lib/constants'
import { BUSINESS_TIME_ZONE } from '@/lib/utils/timezone'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { getBusinessDayRange } from '@/lib/utils/dates'

type Window = { startTime: string; endTime: string; reason: string | null }

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as {
      startDate?: string
      days?: number
    }

    // Clamp days to configured maximum
    const maxDays = APP_CONFIG.MAX_ADVANCE_BOOKING_DAYS
    const days = Math.max(1, Math.min(body.days ?? maxDays, maxDays))

    // Parse start date as business-local date (YYYY-MM-DD) or default to today in business TZ
    let start: Date
    if (body.startDate) {
      start = fromZonedTime(`${body.startDate}T00:00:00.000`, BUSINESS_TIME_ZONE)
    } else {
      const now = new Date()
      const todayKey = format(toZonedTime(now, BUSINESS_TIME_ZONE), 'yyyy-MM-dd')
      start = fromZonedTime(`${todayKey}T00:00:00.000`, BUSINESS_TIME_ZONE)
    }

    const end = addDays(start, days - 1)

    // Determine the source week (Sunday -> Saturday) from the start date
    const weekStart = startOfWeek(start, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(start, { weekStartsOn: 0 })

    // Fetch slot windows from the source week
    const { start: sourceWeekStart } = getBusinessDayRange(weekStart)
    const { endExclusive: sourceWeekEnd } = getBusinessDayRange(weekEnd)
    const sourceWeekSlots = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: sourceWeekStart,
          lt: sourceWeekEnd,
        },
      },
      orderBy: { date: 'asc' },
    })

    if (sourceWeekSlots.length === 0) {
      return NextResponse.json(
        { error: 'No available slots found in the source week. Add slots for this week first.' },
        { status: 400 },
      )
    }

    // Build a pattern of windows per weekday (0-6)
    const pattern = new Map<number, Window[]>()
    for (const slot of sourceWeekSlots) {
      const weekday = toZonedTime(slot.date, BUSINESS_TIME_ZONE).getDay()
      const arr = pattern.get(weekday) ?? []
      // Avoid duplicate windows in the pattern for a weekday
      if (!arr.some((w) => w.startTime === slot.startTime && w.endTime === slot.endTime && w.reason === slot.reason)) {
        arr.push({ startTime: slot.startTime, endTime: slot.endTime, reason: slot.reason ?? null })
      }
      pattern.set(weekday, arr)
    }

    // Fetch existing slots in the target range to avoid duplicates and skip pre-populated days
    const { start: rangeStart } = getBusinessDayRange(start)
    const { endExclusive: rangeEnd } = getBusinessDayRange(end)
    const existingInRange = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: rangeStart,
          lt: rangeEnd,
        },
      },
      orderBy: { date: 'asc' },
    })

    const existingByDateKey = new Map<string, Window[]>()
    for (const s of existingInRange) {
      const key = format(toZonedTime(s.date, BUSINESS_TIME_ZONE), 'yyyy-MM-dd')
      const list = existingByDateKey.get(key) ?? []
      list.push({ startTime: s.startTime, endTime: s.endTime, reason: s.reason ?? null })
      existingByDateKey.set(key, list)
    }

    const toCreate: { date: Date; startTime: string; endTime: string; reason: string | null }[] = []

    for (let i = 0; i < days; i++) {
      const targetInBusinessTZ = addDays(toZonedTime(start, BUSINESS_TIME_ZONE), i)
      const dateKey = format(targetInBusinessTZ, 'yyyy-MM-dd')
      const target = fromZonedTime(targetInBusinessTZ, BUSINESS_TIME_ZONE)

      // Skip days that already have any slots
      if (existingByDateKey.has(dateKey)) continue

      const weekday = targetInBusinessTZ.getDay()
      const windows = pattern.get(weekday)
      if (!windows || windows.length === 0) continue

      for (const w of windows) {
        // Create using business-local midnight converted to UTC
        const localDate = fromZonedTime(`${dateKey}T00:00:00.000`, BUSINESS_TIME_ZONE)
        toCreate.push({ date: localDate, startTime: w.startTime, endTime: w.endTime, reason: w.reason })
      }
    }

    if (toCreate.length === 0) {
      return NextResponse.json({ success: true, created: 0, message: 'No new slots to create.' })
    }

    // Insert all new slots
    const result = await prisma.availableSlot.createMany({ data: toCreate })

    return NextResponse.json({ success: true, created: result.count })
  } catch (error) {
    console.error('Error bulk-creating available slots:', error)
    return NextResponse.json({ error: 'Failed to bulk-create available slots' }, { status: 500 })
  }
}
