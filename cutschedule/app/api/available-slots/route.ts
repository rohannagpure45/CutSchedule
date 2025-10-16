import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { BUSINESS_TIME_ZONE } from '@/lib/utils/timezone'
import { format } from 'date-fns'
import { getBusinessDayRange } from '@/lib/utils/dates'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication - rely on OAuth allowed test users
    const session = await getServerSession(authOptions)

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Calculate today's start time in business timezone for filtering
    const now = new Date()
    const todayInBusinessTZ = toZonedTime(now, BUSINESS_TIME_ZONE)
    const todayKey = format(todayInBusinessTZ, 'yyyy-MM-dd')
    const todayStart = fromZonedTime(`${todayKey}T00:00:00.000`, BUSINESS_TIME_ZONE)

    // Fetch slots from today onwards (filter out past slots in query)
    const availableSlots = await prisma.availableSlot.findMany({
      where: {
        date: {
          gte: todayStart
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    return NextResponse.json(availableSlots)
  } catch (error) {
    console.error('Error fetching available slots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available slots' },
      { status: 500 }
    )
  }
}

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

    const body = await request.json()
    const { date, startTime, endTime, reason } = body

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Date, start time, and end time are required' },
        { status: 400 }
      )
    }

    // Interpret the date string as midnight in business timezone, then convert to UTC for storage
    let slotDate: Date
    if (typeof date === 'string') {
      // Validate YYYY-MM-DD format before constructing ISO string
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: 'Date must be in YYYY-MM-DD format' },
          { status: 400 }
        )
      }
      const iso = `${date}T00:00:00.000`
      slotDate = fromZonedTime(iso, BUSINESS_TIME_ZONE)
    } else if (date instanceof Date) {
      // Derive calendar parts via UTC getters to avoid local-time shifts
      const y = date.getUTCFullYear()
      const m = date.getUTCMonth() + 1
      const d = date.getUTCDate()
      slotDate = fromZonedTime(`${y.toString().padStart(4,'0')}-${m.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}T00:00:00.000`, BUSINESS_TIME_ZONE)
    } else {
      const dObj = new Date(date)
      const y = dObj.getUTCFullYear()
      const m = dObj.getUTCMonth() + 1
      const d = dObj.getUTCDate()
      slotDate = fromZonedTime(`${y.toString().padStart(4,'0')}-${m.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}T00:00:00.000`, BUSINESS_TIME_ZONE)
    }

    const availableSlot = await prisma.availableSlot.create({
      data: {
        date: slotDate,
        startTime,
        endTime,
        reason: reason || null
      }
    })

    return NextResponse.json(availableSlot)
  } catch (error) {
    console.error('Error creating available slot:', error)
    return NextResponse.json(
      { error: 'Failed to create available slot' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication - rely on OAuth allowed test users
    const session = await getServerSession(authOptions)

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.availableSlot.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting available slot:', error)
    return NextResponse.json(
      { error: 'Failed to delete available slot' },
      { status: 500 }
    )
  }
}
