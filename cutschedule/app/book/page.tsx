"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BookingForm } from "@/components/booking/BookingForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { type AppointmentBookingData } from "@/lib/utils/validation"
import { APP_CONFIG } from "@/lib/constants"

export default function BookingPage() {
  const router = useRouter()
  const [bookingStatus, setBookingStatus] = useState<'form' | 'success' | 'error'>('form')
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [appointmentId, setAppointmentId] = useState<string>("")
  const [failedPhoneNumber, setFailedPhoneNumber] = useState<string>("")

  const handleBookingSubmit = async (data: AppointmentBookingData) => {
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Store phone number if booking fails
        setFailedPhoneNumber(data.phoneNumber)
        throw new Error(errorData.error || 'Failed to book appointment')
      }

      const result = await response.json()
      setAppointmentId(result.id)
      setBookingStatus('success')

      // Redirect to confirmation page after a short delay
      setTimeout(() => {
        router.push(`/book/confirmation?id=${result.id}`)
      }, 2000)

    } catch (error) {
      console.error('Booking error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
      setBookingStatus('error')
    }
  }

  if (bookingStatus === 'success') {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card className="text-center">
            <CardContent className="pt-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
              <p className="text-muted-foreground mb-4">
                Your appointment has been successfully booked. You will receive an SMS confirmation shortly.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to confirmation page...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (bookingStatus === 'error') {
    const hasExistingAppointment = errorMessage.toLowerCase().includes('already have') ||
                                   errorMessage.toLowerCase().includes('upcoming appointment')

    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card className="text-center">
            <CardContent className="pt-6">
              <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${hasExistingAppointment ? 'text-blue-500' : 'text-red-500'}`} />
              <h1 className="text-2xl font-bold mb-2">
                {hasExistingAppointment ? 'Already Have an Appointment' : 'Booking Failed'}
              </h1>
              <p className="text-muted-foreground mb-6">
                {hasExistingAppointment
                  ? 'You already have an upcoming appointment scheduled. Would you like to view or manage it?'
                  : errorMessage
                }
              </p>

              {hasExistingAppointment ? (
                <div className="space-y-2">
                  <Button
                    asChild
                    className="w-full"
                  >
                    <Link href={failedPhoneNumber ? `/manage-appointment?phone=${encodeURIComponent(failedPhoneNumber)}` : '/manage-appointment'}>
                      View/Manage Appointment
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setBookingStatus('form')}
                    className="w-full"
                  >
                    Back to Booking
                  </Button>
                  <Button variant="ghost" asChild className="w-full">
                    <Link href="/">Go Home</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <Button onClick={() => setBookingStatus('form')} className="mr-2">
                    Try Again
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/">Go Home</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/gallery">View Gallery</Link>
          </Button>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Book Your Appointment</h1>
          <p className="text-lg text-muted-foreground">
            Schedule your Haircut with Neil
          </p>
        </div>
      </div>

      {/* Booking Form */}
      <BookingForm onSubmit={handleBookingSubmit} />

      {/* Additional Information */}
      <div className="mt-12 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Before Your Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                You will receive SMS confirmations and reminders for your appointment
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Please arrive 5 minutes early for your appointment
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                You can reschedule or cancel using the link in your SMS confirmation
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                For urgent changes, DM me at kerr_blendz
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}