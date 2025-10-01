import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Get all blocked dates (public endpoint - no auth required)
    const blockedDates = await prisma.blockedDate.findMany({
      where: {
        date: {
          gte: new Date(), // Only return future blocked dates
        },
      },
      select: {
        date: true,
        isFullDay: true,
      },
      orderBy: {
        date: 'asc',
      },
    })

    return NextResponse.json(blockedDates)
  } catch (error) {
    console.error('Error fetching blocked dates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blocked dates' },
      { status: 500 }
    )
  }
}
