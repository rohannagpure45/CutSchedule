"use client"

import { useState, useEffect, Suspense, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { BookingForm } from "@/components/booking/BookingForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { type AppointmentBookingData } from "@/lib/utils/validation"
import { formatETDateLong, formatETTime } from '@/lib/utils/timezone'

interface Appointment {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  startTime: string
  endTime: string
  status: string
}

function RescheduleContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const appointmentId = searchParams?.get('id')

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string>("")

  useEffect(() => {
    if (appointmentId) {
      fetchAppointment()
    } else {
      setError("No appointment ID provided")
      setLoading(false)
    }
  }, [appointmentId, fetchAppointment])

  const fetchAppointment = useCallback(async () => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch appointment')
      }

      const data = await response.json()
      setAppointment(data)
    } catch (err) {
      console.error('Error fetching appointment:', err)
      setError('Failed to load appointment details')
    } finally {
      setLoading(false)
    }
  }, [appointmentId])

  const handleReschedule = async (data: AppointmentBookingData) => {
    if (!appointmentId) return

    setRescheduling(true)
    setRescheduleError("")

    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: data.date,
          time: data.time,
          status: 'confirmed'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reschedule appointment')
      }

      const result = await response.json()

      // Redirect to confirmation page
      router.push(`/book/confirmation?id=${result.id}`)
    } catch (err) {
      console.error('Reschedule error:', err)
      setRescheduleError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setRescheduling(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading appointment details...</p>
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
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Appointment Not Found</h1>
              <p className="text-muted-foreground mb-4">
                {error || "We couldn't find the appointment details."}
              </p>
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href="/manage-appointment">Find My Appointment</Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/">Go Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Extract date and time from appointment for pre-filling
  const appointmentDate = new Date(appointment.startTime)
  const initialDate = appointmentDate.toISOString().split('T')[0]
  const hours = appointmentDate.getHours().toString().padStart(2, '0')
  const minutes = appointmentDate.getMinutes().toString().padStart(2, '0')
  const initialTime = `${hours}:${minutes}`

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/manage-appointment?phone=${encodeURIComponent(appointment.phoneNumber)}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Appointment
          </Link>
        </Button>

        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Reschedule Appointment</h1>
          <p className="text-lg text-muted-foreground">
            Select a new date and time for your appointment
          </p>
        </div>
      </div>

      {/* Current Appointment Info */}
      <div className="max-w-2xl mx-auto mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Appointment:</p>
              <p className="font-semibold">
                {formatETDateLong(appointment.startTime)} at {formatETTime(appointment.startTime)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reschedule Error */}
      {rescheduleError && (
        <div className="max-w-2xl mx-auto mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <p className="text-sm">{rescheduleError}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Booking Form (reused for rescheduling) */}
      <BookingForm
        onSubmit={handleReschedule}
        initialData={{
          clientName: appointment.clientName,
          phoneNumber: appointment.phoneNumber,
          date: initialDate,
          time: initialTime
        }}
      />

      {/* Additional Info */}
      <div className="mt-12 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm text-muted-foreground text-center">
              <p>You will receive an SMS confirmation for your rescheduled appointment</p>
              <p>
                Need help? Call us at{' '}
                <a href={`tel:${appointment.phoneNumber}`} className="text-primary hover:underline">
                  {appointment.phoneNumber}
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ReschedulePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <RescheduleContent />
    </Suspense>
  )
}
