import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns'
import { BUSINESS_TIME_ZONE } from '@/lib/utils/timezone'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

type Window = { startTime: string; endTime: string; reason: string | null }

export async function POST(request: NextRequest) {
  try {
    // Verify authentication - rely on OAuth allowed test users
    const session = await getServerSession(authOptions)

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get today in business timezone
    const now = new Date()
    const todayInBusinessTZ = toZonedTime(now, BUSINESS_TIME_ZONE)
    const todayKey = format(todayInBusinessTZ, 'yyyy-MM-dd')
    const todayStart = fromZonedTime(`${todayKey}T00:00:00.000`, BUSINESS_TIME_ZONE)

    // Calculate current week boundaries (Sunday to Saturday)
    const currentWeekStart = startOfWeek(todayInBusinessTZ, { weekStartsOn: 0 })
    const currentWeekEnd = endOfWeek(todayInBusinessTZ, { weekStartsOn: 0 })

    // Convert week boundaries to UTC for database queries
    const currentWeekStartUTC = fromZonedTime(
      `${format(currentWeekStart, 'yyyy-MM-dd')}T00:00:00.000`,
      BUSINESS_TIME_ZONE
    )
    const currentWeekEndUTC = fromZonedTime(
      `${format(addDays(currentWeekEnd, 1), 'yyyy-MM-dd')}T00:00:00.000`,
      BUSINESS_TIME_ZONE
    )

    // Fetch slots from current week that are >= today (remaining slots only)
    const remainingCurrentWeekSlots = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: todayStart,
          lt: currentWeekEndUTC,
        },
      },
      orderBy: { date: 'asc' },
    })

    if (remainingCurrentWeekSlots.length === 0) {
      return NextResponse.json(
        { error: 'No remaining slots found in the current week. Add slots for upcoming days first.' },
        { status: 400 },
      )
    }

    // Build a pattern of windows per weekday (0-6) from remaining slots
    const pattern = new Map<number, Window[]>()
    for (const slot of remainingCurrentWeekSlots) {
      const weekday = toZonedTime(slot.date, BUSINESS_TIME_ZONE).getDay()
      const arr = pattern.get(weekday) ?? []
      // Avoid duplicate windows in the pattern for a weekday
      if (!arr.some((w) => w.startTime === slot.startTime && w.endTime === slot.endTime && w.reason === slot.reason)) {
        arr.push({ startTime: slot.startTime, endTime: slot.endTime, reason: slot.reason ?? null })
      }
      pattern.set(weekday, arr)
    }

    // Find the next week that doesn't have any slots yet (for repeated presses)
    // Start searching from next week's Sunday
    const nextWeekStart = addDays(currentWeekStart, 7)
    let targetWeekStart = nextWeekStart
    let searchWeek = 0
    const MAX_WEEKS_TO_SEARCH = 52 // Search up to 1 year ahead

    // Search for the first week that has no slots
    while (searchWeek < MAX_WEEKS_TO_SEARCH) {
      const weekStartUTC = fromZonedTime(
        `${format(addDays(nextWeekStart, searchWeek * 7), 'yyyy-MM-dd')}T00:00:00.000`,
        BUSINESS_TIME_ZONE
      )
      const weekEndUTC = fromZonedTime(
        `${format(addDays(nextWeekStart, searchWeek * 7 + 7), 'yyyy-MM-dd')}T00:00:00.000`,
        BUSINESS_TIME_ZONE
      )

      const slotsInWeek = await prisma.availableSlot.count({
        where: {
          date: {
            gte: weekStartUTC,
            lt: weekEndUTC,
          },
        },
      })

      if (slotsInWeek === 0) {
        targetWeekStart = addDays(nextWeekStart, searchWeek * 7)
        break
      }

      searchWeek++
    }

    if (searchWeek >= MAX_WEEKS_TO_SEARCH) {
      return NextResponse.json(
        { error: 'All weeks for the next year already have slots. No more weeks available.' },
        { status: 400 },
      )
    }

    // Fetch existing slots in the target week to implement merge behavior
    const targetWeekStartUTC = fromZonedTime(
      `${format(targetWeekStart, 'yyyy-MM-dd')}T00:00:00.000`,
      BUSINESS_TIME_ZONE
    )
    const targetWeekEndUTC = fromZonedTime(
      `${format(addDays(targetWeekStart, 7), 'yyyy-MM-dd')}T00:00:00.000`,
      BUSINESS_TIME_ZONE
    )

    const existingInTargetWeek = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: targetWeekStartUTC,
          lt: targetWeekEndUTC,
        },
      },
      orderBy: { date: 'asc' },
    })

    const existingByDateKey = new Set<string>()
    for (const s of existingInTargetWeek) {
      const key = format(toZonedTime(s.date, BUSINESS_TIME_ZONE), 'yyyy-MM-dd')
      existingByDateKey.add(key)
    }

    // Create slots for the target week
    const toCreate: { date: Date; startTime: string; endTime: string; reason: string | null }[] = []

    for (let i = 0; i < 7; i++) {
      const targetDayInBusinessTZ = addDays(targetWeekStart, i)
      const dateKey = format(targetDayInBusinessTZ, 'yyyy-MM-dd')

      // Skip days that already have slots (merge behavior)
      if (existingByDateKey.has(dateKey)) continue

      const weekday = targetDayInBusinessTZ.getDay()
      const windows = pattern.get(weekday)
      if (!windows || windows.length === 0) continue

      for (const w of windows) {
        // Create using business-local midnight converted to UTC
        const localDate = fromZonedTime(`${dateKey}T00:00:00.000`, BUSINESS_TIME_ZONE)
        toCreate.push({ date: localDate, startTime: w.startTime, endTime: w.endTime, reason: w.reason })
      }
    }

    if (toCreate.length === 0) {
      return NextResponse.json({ success: true, created: 0, message: 'No new slots to create. All days in target week already have slots.' })
    }

    // Insert all new slots
    const result = await prisma.availableSlot.createMany({ data: toCreate })

    return NextResponse.json({ success: true, created: result.count })
  } catch (error) {
    console.error('Error bulk-creating available slots:', error)
    return NextResponse.json({ error: 'Failed to bulk-create available slots' }, { status: 500 })
  }
}
