"use client"

import * as React from "react"
import { SimpleCalendar } from "@/components/ui/simple-calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addDays, isSameDay, startOfDay, endOfDay, isBefore, isAfter } from "date-fns"
import { formatETDateLong } from "@/lib/utils/timezone"
import { APP_CONFIG } from "@/lib/constants"


interface DatePickerProps {
  selectedDate?: Date
  onDateSelect: (date: Date) => void
  workingDays?: number[] // Array of working days (0-6, Sunday-Saturday)
  blockedDates?: Date[] // Array of blocked dates (blacklist approach)
  availableDates?: Date[] // Array of available dates (whitelist approach - takes precedence)
  className?: string
}

export function DatePicker({
  selectedDate,
  onDateSelect,
  workingDays = [1, 2, 3, 4, 5, 6], // Default: Monday-Saturday
  blockedDates = [],
  availableDates,
  className
}: DatePickerProps) {
  // Normalize comparisons to day boundaries to avoid disabling "today" after midnight
  const today = startOfDay(new Date())
  const maxDate = addDays(today, APP_CONFIG.MAX_ADVANCE_BOOKING_DAYS)

  const isDateDisabled = (date: Date) => {
    // Disable past dates (compare by day, not time)
    if (isBefore(date, today)) return true

    // Disable dates beyond max advance booking (inclusive of the last day)
    if (isAfter(date, endOfDay(maxDate))) return true

    // If availableDates is provided (whitelist approach), only allow those dates.
    // Treat empty array as "no dates available" so everything is disabled by default.
    if (availableDates !== undefined) {
      return !availableDates.some(availableDate => isSameDay(availableDate, date))
    }

    // Otherwise, use the blacklist approach (old behavior)
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
              Selected: {formatETDateLong(selectedDate)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
