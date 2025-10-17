"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { formatETDateLong } from "@/lib/utils/timezone"
import { Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimeSlotPickerProps {
  selectedDate?: Date
  selectedTime?: string
  onTimeSelect: (time: string) => void
  availableSlots?: string[]
  loading?: boolean
  className?: string
}

export function TimeSlotPicker({
  selectedDate,
  selectedTime,
  onTimeSelect,
  availableSlots = [],
  loading = false,
  className
}: TimeSlotPickerProps) {
  if (!selectedDate) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Select Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p>Please select a date first</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return format(date, 'h:mm a')
  }

  const groupSlotsByPeriod = (slots: string[]) => {
    const morning: string[] = []
    const afternoon: string[] = []
    const evening: string[] = []

    slots.forEach(slot => {
      const hour = parseInt(slot.split(':')[0])
      if (hour < 12) {
        morning.push(slot)
      } else if (hour < 17) {
        afternoon.push(slot)
      } else {
        evening.push(slot)
      }
    })

    return { morning, afternoon, evening }
  }

  const { morning, afternoon, evening } = groupSlotsByPeriod(availableSlots)

  const renderSlotGroup = (title: string, slots: string[]) => {
    if (slots.length === 0) return null

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {slots.map((slot) => (
            <Button
              key={slot}
              variant={selectedTime === slot ? "default" : "outline"}
              size="sm"
              onClick={() => onTimeSelect(slot)}
              className={cn(
                "justify-center text-xs",
                selectedTime === slot && "ring-2 ring-ring ring-offset-2"
              )}
            >
              {formatTime(slot)}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Available Times
        </CardTitle>
        <p className="text-sm text-muted-foreground">{formatETDateLong(selectedDate)}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2 text-muted-foreground">Loading available times...</span>
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No available times for this date</p>
              <p className="text-xs mt-1">Please select another date</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {renderSlotGroup("Morning", morning)}
            {renderSlotGroup("Afternoon", afternoon)}
            {renderSlotGroup("Evening", evening)}
          </div>
        )}

        {selectedTime && (
          <div className="mt-6 p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">
              Selected: {formatTime(selectedTime)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
