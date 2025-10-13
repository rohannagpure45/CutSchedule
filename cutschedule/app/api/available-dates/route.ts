import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { startOfToday } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    // Public endpoint - no authentication required
    // Fetch all available slots from today onwards
    const today = startOfToday()

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
