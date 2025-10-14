import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  getDay,
  startOfDay,
  startOfToday,
  startOfWeek,
} from 'date-fns'
import { APP_CONFIG } from '@/lib/constants'

type Window = { startTime: string; endTime: string; reason: string | null }

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as {
      startDate?: string
      days?: number
    }

    // Clamp days to configured maximum
    const maxDays = APP_CONFIG.MAX_ADVANCE_BOOKING_DAYS
    const days = Math.max(1, Math.min(body.days ?? maxDays, maxDays))

    // Parse start date as local date (YYYY-MM-DD) or default to today
    let start: Date
    if (body.startDate) {
      const [y, m, d] = body.startDate.split('-').map((v) => parseInt(v, 10))
      start = new Date(y, (m || 1) - 1, d || 1)
    } else {
      start = startOfToday()
    }

    const end = addDays(start, days - 1)

    // Determine the source week (Sunday -> Saturday) from the start date
    const weekStart = startOfWeek(start, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(start, { weekStartsOn: 0 })

    // Fetch slot windows from the source week
    const sourceWeekSlots = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: startOfDay(weekStart),
          lte: endOfDay(weekEnd),
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
      const weekday = getDay(slot.date)
      const arr = pattern.get(weekday) ?? []
      // Avoid duplicate windows in the pattern for a weekday
      if (!arr.some((w) => w.startTime === slot.startTime && w.endTime === slot.endTime && w.reason === slot.reason)) {
        arr.push({ startTime: slot.startTime, endTime: slot.endTime, reason: slot.reason ?? null })
      }
      pattern.set(weekday, arr)
    }

    // Fetch existing slots in the target range to avoid duplicates and skip pre-populated days
    const existingInRange = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: startOfDay(start),
          lte: endOfDay(end),
        },
      },
      orderBy: { date: 'asc' },
    })

    const existingByDateKey = new Map<string, Window[]>()
    for (const s of existingInRange) {
      const key = format(s.date, 'yyyy-MM-dd')
      const list = existingByDateKey.get(key) ?? []
      list.push({ startTime: s.startTime, endTime: s.endTime, reason: s.reason ?? null })
      existingByDateKey.set(key, list)
    }

    const toCreate: { date: Date; startTime: string; endTime: string; reason: string | null }[] = []

    for (let i = 0; i < days; i++) {
      const target = addDays(start, i)
      const dateKey = format(target, 'yyyy-MM-dd')

      // Skip days that already have any slots
      if (existingByDateKey.has(dateKey)) continue

      const weekday = getDay(target)
      const windows = pattern.get(weekday)
      if (!windows || windows.length === 0) continue

      for (const w of windows) {
        // Create with local date (avoid UTC shift)
        const [y, m, d] = [target.getFullYear(), target.getMonth(), target.getDate()]
        const localDate = new Date(y, m, d)
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
