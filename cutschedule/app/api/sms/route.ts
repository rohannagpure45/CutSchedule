import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendSMS } from '@/lib/sms'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  try {
    // Get session to verify admin access
    const session = await getServerSession()
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const appointmentId = searchParams.get('appointmentId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (appointmentId) {
      where.appointmentId = appointmentId
    }

    const smsLogs = await prisma.sMSLog.findMany({
      where,
      orderBy: {
        sentAt: 'desc',
      },
      take: limit,
    })

    return NextResponse.json(smsLogs)
  } catch (error) {
    console.error('Error fetching SMS logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SMS logs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session to verify admin access
    const session = await getServerSession()
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { phoneNumber, messageType, clientName, date, time, appointmentId } = body

    // Validate required fields
    if (!phoneNumber || !messageType || !clientName) {
      return NextResponse.json(
        { error: 'Missing required fields: phoneNumber, messageType, clientName' },
        { status: 400 }
      )
    }

    // Send SMS
    const result = await sendSMS(phoneNumber, messageType, {
      clientName,
      date: date || '',
      time: time || '',
      appointmentId: appointmentId || 'manual'
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: 'SMS sent successfully'
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error sending SMS:', error)
    return NextResponse.json(
      { error: 'Failed to send SMS' },
      { status: 500 }
    )
  }
}