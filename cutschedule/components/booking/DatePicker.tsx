"use client"

import * as React from "react"
import { SimpleCalendar } from "@/components/ui/simple-calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addDays, format, isSameDay } from "date-fns"
import { APP_CONFIG } from "@/lib/constants"

interface DatePickerProps {
  selectedDate?: Date
  onDateSelect: (date: Date) => void
  workingDays?: number[] // Array of working days (0-6, Sunday-Saturday)
  blockedDates?: Date[] // Array of blocked dates
  className?: string
}

export function DatePicker({
  selectedDate,
  onDateSelect,
  workingDays = [1, 2, 3, 4, 5, 6], // Default: Monday-Saturday
  blockedDates = [],
  className
}: DatePickerProps) {
  const today = new Date()
  const maxDate = addDays(today, APP_CONFIG.MAX_ADVANCE_BOOKING_DAYS)

  const isDateDisabled = (date: Date) => {
    // Disable past dates
    if (date < today) return true

    // Disable dates beyond max advance booking
    if (date > maxDate) return true

    // Disable non-working days
    const dayOfWeek = date.getDay()
    if (!workingDays.includes(dayOfWeek)) return true

    // Disable blocked dates
    if (blockedDates.some(blockedDate => isSameDay(blockedDate, date))) {
      return true
    }

    return false
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Select Date</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleCalendar
          selected={selectedDate}
          onSelect={onDateSelect}
          disabled={isDateDisabled}
          className="rounded-md border"
        />
        {selectedDate && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">
              Selected: {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}