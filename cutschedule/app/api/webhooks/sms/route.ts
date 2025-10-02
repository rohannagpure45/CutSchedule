import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Webhook handler for incoming SMS messages from Twilio
 * Handles STOP/START commands for opt-out management
 */
export async function POST(request: NextRequest) {
  try {
    // Parse Twilio's form data
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    // Log incoming message
    console.log('Incoming SMS:', { from, body, messageSid })

    // Normalize the message body
    const normalizedBody = body?.trim().toUpperCase()

    // Handle STOP/UNSUBSCRIBE commands
    if (normalizedBody === 'STOP' || normalizedBody === 'UNSUBSCRIBE' || normalizedBody === 'END' || normalizedBody === 'QUIT') {
      // Mark customer as opted out in database
      // Note: You may want to create an opt-out table or add a field to track this
      console.log(`Customer ${from} opted out`)

      // Twilio automatically handles STOP responses, but you can log it
      await logIncomingSMS(from, body, messageSid, 'opt-out')

      // Return TwiML response (optional - Twilio handles STOP automatically)
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: {
            'Content-Type': 'text/xml',
          },
        }
      )
    }

    // Handle START/SUBSCRIBE commands
    if (normalizedBody === 'START' || normalizedBody === 'SUBSCRIBE' || normalizedBody === 'YES') {
      // Mark customer as opted back in
      console.log(`Customer ${from} opted back in`)
      await logIncomingSMS(from, body, messageSid, 'opt-in')

      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: {
            'Content-Type': 'text/xml',
          },
        }
      )
    }

    // Log other messages
    await logIncomingSMS(from, body, messageSid, 'received')

    // Return empty TwiML response (no auto-reply)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    )
  } catch (error) {
    console.error('Error processing incoming SMS webhook:', error)

    // Return empty TwiML even on error to prevent Twilio retries
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    )
  }
}

/**
 * Log incoming SMS messages
 */
async function logIncomingSMS(
  from: string,
  body: string,
  messageSid: string,
  type: 'opt-out' | 'opt-in' | 'received'
) {
  try {
    // You could create a separate table for incoming messages
    // For now, just console log
    console.log(`Incoming SMS [${type}]:`, {
      from,
      body,
      messageSid,
      timestamp: new Date().toISOString(),
    })

    // Optional: Store in database
    // await prisma.incomingSMS.create({
    //   data: {
    //     phoneNumber: from,
    //     message: body,
    //     messageSid,
    //     type,
    //   },
    // })
  } catch (error) {
    console.error('Error logging incoming SMS:', error)
  }
}

// GET endpoint for verification (optional)
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'Twilio SMS Webhook',
  })
}
