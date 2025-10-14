import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail || adminEmail.trim() === '') {
      console.error('ADMIN_EMAIL environment variable is not configured')
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_EMAIL not configured' },
        { status: 500 }
      )
    }
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const availableSlots = await prisma.availableSlot.findMany({
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
    // Check authentication
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail || adminEmail.trim() === '') {
      console.error('ADMIN_EMAIL environment variable is not configured')
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_EMAIL not configured' },
        { status: 500 }
      )
    }
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, startTime, endTime, reason } = body

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Date, start time, and end time are required' },
        { status: 400 }
      )
    }

    // Parse the date as a local date (avoid UTC shift from YYYY-MM-DD)
    let slotDate: Date
    if (typeof date === 'string') {
      const [y, m, d] = date.split('-').map((v: string) => parseInt(v, 10))
      slotDate = new Date(y, (m || 1) - 1, d || 1)
    } else if (date instanceof Date) {
      slotDate = date
    } else {
      slotDate = new Date(date)
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
    // Check authentication
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail || adminEmail.trim() === '') {
      console.error('ADMIN_EMAIL environment variable is not configured')
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_EMAIL not configured' },
        { status: 500 }
      )
    }
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
