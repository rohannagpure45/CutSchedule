"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "./DatePicker"
import { TimeSlotPicker } from "./TimeSlotPicker"
import { appointmentBookingSchema, type AppointmentBookingData } from "@/lib/utils/validation"
import { formatDate, formatTime } from "@/lib/utils/dates"
import { User, Phone, Calendar, Clock, ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface BookingFormProps {
  onSubmit: (data: AppointmentBookingData) => Promise<void>
  className?: string
  initialData?: Partial<AppointmentBookingData>
}

type BookingStep = 'date' | 'time' | 'details' | 'confirm'

export function BookingForm({ onSubmit, className, initialData }: BookingFormProps) {
  const [currentStep, setCurrentStep] = useState<BookingStep>('date')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialData?.date ? new Date(initialData.date) : undefined
  )
  const [selectedTime, setSelectedTime] = useState<string | undefined>(initialData?.time)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [availableDates, setAvailableDates] = useState<Date[]>([])
  const [loading, setLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch
  } = useForm<AppointmentBookingData>({
    resolver: zodResolver(appointmentBookingSchema),
    defaultValues: initialData
  })

  // Watch form values for validation
  const watchedValues = watch()

  // Fetch available dates on mount
  useEffect(() => {
    const fetchAvailableDates = async () => {
      try {
        const response = await fetch('/api/available-slots')
        if (response.ok) {
          const data = await response.json()
          // Convert date strings to Date objects and get unique dates
          const uniqueDates = Array.from(
            new Set(data.map((item: any) => new Date(item.date).toDateString()))
          ).map(dateStr => new Date(dateStr))
          setAvailableDates(uniqueDates)
        }
      } catch (error) {
        console.error('Failed to fetch available dates:', error)
      }
    }
    fetchAvailableDates()
  }, [])

  // Fetch available time slots when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate)
      setValue('date', formatDate(selectedDate))
    }
  }, [selectedDate, setValue])

  // Update form when time is selected
  useEffect(() => {
    if (selectedTime) {
      setValue('time', selectedTime)
    }
  }, [selectedTime, setValue])

  const fetchAvailableSlots = async (date: Date) => {
    setSlotsLoading(true)
    try {
      const response = await fetch(`/api/availability?date=${formatDate(date)}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableSlots(data.slots || [])
      } else {
        setAvailableSlots([])
      }
    } catch (error) {
      console.error('Failed to fetch available slots:', error)
      setAvailableSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedTime(undefined) // Reset time when date changes
    setCurrentStep('time')
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
    setCurrentStep('details')
  }

  const handleFormSubmit = async (data: AppointmentBookingData) => {
    setLoading(true)
    try {
      await onSubmit(data)
    } catch (error) {
      console.error('Booking failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const canProceedToDetails = selectedDate && selectedTime
  const canSubmit = canProceedToDetails && watchedValues.clientName && watchedValues.phoneNumber

  const steps = [
    { id: 'date', label: 'Date', icon: Calendar, completed: !!selectedDate },
    { id: 'time', label: 'Time', icon: Clock, completed: !!selectedTime },
    { id: 'details', label: 'Details', icon: User, completed: !!watchedValues.clientName && !!watchedValues.phoneNumber },
  ]

  return (
    <div className={cn("max-w-4xl mx-auto space-y-6", className)}>
      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isActive = currentStep === step.id ||
                             (currentStep === 'confirm' && step.completed)
              const isCompleted = step.completed
              const Icon = step.icon

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : isActive
                        ? "border-primary text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="ml-3">
                    <p className={cn(
                      "text-sm font-medium",
                      isCompleted || isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4 mx-4 text-muted-foreground" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Date Selection */}
        <DatePicker
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          availableDates={availableDates}
          className={cn(
            "transition-opacity",
            currentStep !== 'date' && selectedDate && "opacity-75"
          )}
        />

        {/* Time Selection */}
        <TimeSlotPicker
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onTimeSelect={handleTimeSelect}
          availableSlots={availableSlots}
          loading={slotsLoading}
          className={cn(
            "transition-opacity",
            !selectedDate && "opacity-50 pointer-events-none"
          )}
        />
      </div>

      {/* Customer Details Form */}
      {canProceedToDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Your Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Full Name</Label>
                  <Input
                    id="clientName"
                    placeholder="Enter your full name"
                    {...register('clientName')}
                    error={!!errors.clientName}
                  />
                  {errors.clientName && (
                    <p className="text-sm text-destructive">{errors.clientName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="(555) 123-4567"
                    {...register('phoneNumber')}
                    error={!!errors.phoneNumber}
                  />
                  {errors.phoneNumber && (
                    <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
                  )}
                </div>
              </div>

              {/* Appointment Summary */}
              {selectedDate && selectedTime && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Appointment Summary</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><Calendar className="w-4 h-4 inline mr-2" />
                      {selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p><Clock className="w-4 h-4 inline mr-2" />
                      {formatTime(new Date(`2000-01-01T${selectedTime}:00`))} - {
                        formatTime(new Date(new Date(`2000-01-01T${selectedTime}:00`).getTime() + 45 * 60000))
                      } (45 minutes)
                    </p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Booking Appointment...
                  </>
                ) : (
                  'Book Appointment'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}