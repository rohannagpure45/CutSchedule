"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SimpleCalendarProps {
  selected?: Date
  onSelect?: (date: Date) => void
  disabled?: (date: Date) => boolean
  blockedDates?: Date[]
  className?: string
}

export function SimpleCalendar({
  selected,
  onSelect,
  disabled,
  blockedDates = [],
  className
}: SimpleCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    selected || new Date()
  )

  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month, 1).getDay()
  }

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days: (Date | null)[] = []

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day
      )
      days.push(date)
    }

    return days
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    )
  }

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    )
  }

  const isSameDay = (date1: Date | null, date2: Date | null) => {
    if (!date1 || !date2) return false
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    )
  }

  const isBlocked = (date: Date) => {
    return blockedDates.some(blockedDate => isSameDay(date, blockedDate))
  }

  const days = generateCalendarDays()

  return (
    <div className={cn("p-3", className)}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={goToPreviousMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={goToNextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground h-9 flex items-center justify-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-9" />
          }

          const isSelected = isSameDay(date, selected || null)
          const isDisabled = disabled ? disabled(date) : false
          const isDateBlocked = isBlocked(date)

          return (
            <button
              key={date.toISOString()}
              onClick={() => !isDisabled && onSelect?.(date)}
              disabled={isDisabled}
              className={cn(
                "h-9 w-9 text-sm rounded-md transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isSelected && "bg-blue-700 text-white font-bold hover:bg-blue-800 hover:text-white",
                isDisabled && "bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50 hover:bg-muted/50 hover:text-muted-foreground",
                isDateBlocked && !isSelected && "bg-red-100 text-red-700 font-semibold hover:bg-red-200 hover:text-red-800",
                !isSelected && !isDisabled && !isDateBlocked && "hover:bg-accent"
              )}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
