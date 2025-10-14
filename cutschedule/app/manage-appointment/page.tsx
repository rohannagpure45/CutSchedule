"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar, Clock, MapPin, Phone, ArrowLeft, Search, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { formatETDateLong, formatETTime } from '@/lib/utils/timezone'
import { APP_CONFIG } from "@/lib/constants"
import { normalizePhoneNumber } from "@/lib/utils/validation"

interface Appointment {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  startTime: string
  endTime: string
  status: string
  googleEventId: string | null
}

function ManageAppointmentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const phoneParam = searchParams?.get('phone')

  const [phoneNumber, setPhoneNumber] = useState(phoneParam || '')
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Auto-search if phone number is in URL
  useEffect(() => {
    if (phoneParam && !appointment && !loading) {
      handleSearch()
    }
  }, [phoneParam])

  const handleSearch = async () => {
    if (!phoneNumber.trim()) {
      setError("Please enter a phone number")
      return
    }

    setLoading(true)
    setError("")
    setAppointment(null)

    try {
      const normalized = normalizePhoneNumber(phoneNumber)
      const response = await fetch(`/api/appointments?phone=${encodeURIComponent(normalized)}&status=confirmed`)

      if (!response.ok) {
        throw new Error('Failed to fetch appointment')
      }

      const appointments = await response.json()

      if (!appointments || appointments.length === 0) {
        setError("No upcoming appointment found for this phone number")
        return
      }

      // Filter for upcoming appointments only
      const upcomingAppointments = appointments.filter((apt: Appointment) => {
        const aptDate = new Date(apt.startTime)
        return aptDate > new Date() && apt.status === 'confirmed'
      })

      if (upcomingAppointments.length === 0) {
        setError("No upcoming appointment found for this phone number")
        return
      }

      // Since users can only have one appointment, take the first one
      setAppointment(upcomingAppointments[0])
    } catch (err) {
      console.error('Error fetching appointment:', err)
      setError('Failed to find appointment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelConfirm = async () => {
    if (!appointment) return

    setCancelling(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to cancel appointment')
      }

      setShowCancelDialog(false)
      setAppointment(null)
      setPhoneNumber('')

      // Show success message and redirect
      alert('Your appointment has been cancelled successfully. You will receive a confirmation SMS.')
      router.push('/')
    } catch (err) {
      console.error('Error cancelling appointment:', err)
      alert('Failed to cancel appointment. Please try again or call us directly.')
    } finally {
      setCancelling(false)
    }
  }

  const formatDateTime = (startTimeStr: string) => {
    const startTime = new Date(startTimeStr)
    if (isNaN(startTime.getTime())) {
      return { date: 'Invalid Date', time: 'Invalid Time' }
    }
    return {
      date: formatETDateLong(startTime),
      time: formatETTime(startTime)
    }
  }

  const formatEndTime = (endTimeStr: string) => {
    const endTime = new Date(endTimeStr)
    if (isNaN(endTime.getTime())) return 'Invalid Time'
    return formatETTime(endTime)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Manage Your Appointment</h1>
          <p className="text-lg text-muted-foreground">
            Enter your phone number to view and manage your booking
          </p>
        </div>
      </div>

      {/* Search Form */}
      {!appointment && (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              Find Your Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <Button
                onClick={handleSearch}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Find My Appointment
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appointment Details */}
      {appointment && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Appointment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Your Appointment
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
                    <p className="text-lg font-semibold">
                      {formatDateTime(appointment.startTime).date}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Time</p>
                    <p className="text-lg font-semibold">
                      {formatDateTime(appointment.startTime).time} - {formatEndTime(appointment.endTime)}
                    </p>
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

          {/* Location Info */}
          <Card>
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

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              className="flex-1"
              onClick={() => router.push(`/manage-appointment/reschedule?id=${appointment.id}`)}
            >
              <Clock className="w-4 h-4 mr-2" />
              Reschedule Appointment
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Appointment
            </Button>
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-4 justify-center pt-4">
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/book">Book Another</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {appointment && (
            <div className="py-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{formatDateTime(appointment.startTime).date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">
                    {formatDateTime(appointment.startTime).time} - {formatEndTime(appointment.endTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelling}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel It'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ManageAppointmentPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ManageAppointmentContent />
    </Suspense>
  )
}
