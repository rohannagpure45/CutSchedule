"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Calendar, Clock, MapPin, Phone, MessageSquare, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { APP_CONFIG } from "@/lib/constants"

interface Appointment {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  startTime: string
  endTime: string
  status: string
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const appointmentId = searchParams?.get('id') || null
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (appointmentId) {
      fetchAppointment(appointmentId)
    } else {
      setError("No appointment ID provided")
      setLoading(false)
    }
  }, [appointmentId])

  const fetchAppointment = async (id: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch appointment details')
      }
      const data = await response.json()
      setAppointment(data)
    } catch (error) {
      console.error('Error fetching appointment:', error)
      setError('Failed to load appointment details')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateStr: string, startTimeStr: string) => {
    // startTimeStr is an ISO date string from the API (e.g., "2025-10-17T18:00:00.000Z")
    // We use it directly to create the Date object
    const startTime = new Date(startTimeStr)

    // Validate the date is valid
    if (isNaN(startTime.getTime())) {
      console.error('Invalid date:', { dateStr, startTimeStr })
      return {
        date: 'Invalid Date',
        time: 'Invalid Time'
      }
    }

    return {
      date: format(startTime, 'EEEE, MMMM d, yyyy'),
      time: format(startTime, 'h:mm a')
    }
  }

  const formatEndTime = (endTimeStr: string) => {
    // endTimeStr is an ISO date string from the API (e.g., "2025-10-17T18:45:00.000Z")
    const endTime = new Date(endTimeStr)

    // Validate the date is valid
    if (isNaN(endTime.getTime())) {
      console.error('Invalid end time:', endTimeStr)
      return 'Invalid Time'
    }

    return format(endTime, 'h:mm a')
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading appointment details...</p>
        </div>
      </div>
    )
  }

  if (error || !appointment) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Appointment Not Found</h1>
              <p className="text-muted-foreground mb-4">
                {error || "We couldn't find the appointment details."}
              </p>
              <Button asChild>
                <Link href="/">Go Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { date, time } = formatDateTime(appointment.date, appointment.startTime)
  const endTime = formatEndTime(appointment.endTime)

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
      </Button>

      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Appointment Confirmed!</h1>
          <p className="text-lg text-muted-foreground">
            Your booking has been successfully scheduled
          </p>
        </div>

        {/* Appointment Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Customer</p>
                <p className="text-lg">{appointment.clientName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p className="text-lg">{appointment.phoneNumber}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-lg font-semibold">{date}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Time</p>
                  <p className="text-lg font-semibold">{time} - {endTime}</p>
                  <p className="text-sm text-muted-foreground">(45 minutes)</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Appointment ID</p>
              <p className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
                {appointment.id}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Location & Contact Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location & Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Address</p>
              <p className="text-lg">{APP_CONFIG.BARBER_ADDRESS}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p className="text-lg">{APP_CONFIG.BARBER_PHONE}</p>
            </div>
          </CardContent>
        </Card>

        {/* Important Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Important Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium">SMS Confirmation Sent</p>
                  <p className="text-muted-foreground">
                    You will receive an SMS confirmation and reminders for your appointment
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Clock className="w-4 h-4 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium">Arrive Early</p>
                  <p className="text-muted-foreground">
                    Please arrive 5 minutes before your scheduled time
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Phone className="w-4 h-4 text-purple-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium">Need to Reschedule?</p>
                  <p className="text-muted-foreground">
                    Use the link in your SMS confirmation or call us directly
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4 justify-center">
          <Button asChild>
            <Link href="/">Book Another Appointment</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`tel:${APP_CONFIG.BARBER_PHONE}`}>Call Us</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading appointment details...</p>
        </div>
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}