import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { startOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { BUSINESS_TIME_ZONE } from '@/lib/utils/timezone'

export async function GET(request: NextRequest) {
  try {
    // Public endpoint - no authentication required
    // Fetch all available slots from the start of "today" in business timezone onwards
    // Updated to use correct date-fns-tz imports
    const now = new Date()
    const zonedNow = toZonedTime(now, BUSINESS_TIME_ZONE)
    const today = fromZonedTime(startOfDay(zonedNow), BUSINESS_TIME_ZONE)

    const availableSlots = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: today
        }
      },
      orderBy: {
        date: 'asc'
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true
      }
    })

    return NextResponse.json(availableSlots)
  } catch (error) {
    console.error('Error fetching available dates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available dates' },
      { status: 500 }
    )
  }
}
