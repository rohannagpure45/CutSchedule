import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workingHours = await prisma.workingHours.findMany({
      orderBy: {
        dayOfWeek: 'asc'
      }
    })

    // Ensure all days exist with defaults
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const allDays = daysOfWeek.map((day, index) => {
      const existing = workingHours.find(wh => wh.dayOfWeek === index)
      return existing || {
        id: null,
        dayOfWeek: index,
        startTime: '09:00',
        endTime: '18:00',
        isActive: index >= 1 && index <= 5, // Mon-Fri active by default
      }
    })

    return NextResponse.json(allDays)
  } catch (error) {
    console.error('Error fetching working hours:', error)
    return NextResponse.json(
      { error: 'Failed to fetch working hours' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { days } = body

    if (!Array.isArray(days)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    // Update each day's working hours
    const updates = await Promise.all(
      days.map(async (day) => {
        const { dayOfWeek, startTime, endTime, isActive } = day

        // Validate input
        if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
          throw new Error('Invalid dayOfWeek')
        }

        if (!startTime || !endTime) {
          throw new Error('Start and end times are required')
        }

        // Check if record exists
        const existing = await prisma.workingHours.findUnique({
          where: { dayOfWeek }
        })

        if (existing) {
          // Update existing
          return await prisma.workingHours.update({
            where: { dayOfWeek },
            data: { startTime, endTime, isActive }
          })
        } else {
          // Create new
          return await prisma.workingHours.create({
            data: { dayOfWeek, startTime, endTime, isActive }
          })
        }
      })
    )

    return NextResponse.json({ success: true, data: updates })
  } catch (error) {
    console.error('Error updating working hours:', error)
    return NextResponse.json(
      { error: 'Failed to update working hours' },
      { status: 500 }
    )
  }
}
