'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { ArrowLeft, Plus, CalendarOff, Trash2, Clock } from 'lucide-react'
import { format, parseISO, isFuture } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

interface BlockedDate {
  id: string
  date: string
  startTime: string | null
  endTime: string | null
  isFullDay: boolean
  reason: string | null
  createdAt: string
}

export default function BlockedDatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [isFullDay, setIsFullDay] = useState(true)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [reason, setReason] = useState('')

  useEffect(() => {
    // Don't wait for session, just fetch blocked dates immediately
    // Middleware has already verified we're admin
    fetchBlockedDates()
  }, [])

  const fetchBlockedDates = async () => {
    try {
      const response = await fetch('/api/blocked-dates')
      if (response.ok) {
        const data = await response.json()
        setBlockedDates(data.filter((bd: BlockedDate) =>
          isFuture(parseISO(bd.date)) ||
          format(parseISO(bd.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
        ))
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch blocked dates',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error fetching blocked dates:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch blocked dates',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddBlockedDate = async () => {
    if (!selectedDate) {
      toast({
        title: 'Error',
        description: 'Please select a date',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch('/api/blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(selectedDate, 'yyyy-MM-dd'),
          startTime: !isFullDay ? startTime : null,
          endTime: !isFullDay ? endTime : null,
          isFullDay,
          reason: reason || null
        })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Blocked date added successfully'
        })
        fetchBlockedDates()
        setDialogOpen(false)
        resetForm()
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add blocked date',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error adding blocked date:', error)
      toast({
        title: 'Error',
        description: 'Failed to add blocked date',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/blocked-dates?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Blocked date removed'
        })
        setBlockedDates(prev => prev.filter(bd => bd.id !== id))
      } else {
        toast({
          title: 'Error',
          description: 'Failed to remove blocked date',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error deleting blocked date:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove blocked date',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setSelectedDate(undefined)
    setIsFullDay(true)
    setStartTime('09:00')
    setEndTime('18:00')
    setReason('')
  }

  const getBlockedDatesForCalendar = () => {
    return blockedDates.map(bd => parseISO(bd.date))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session?.user?.isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Blocked Dates</h1>
              <p className="text-gray-600">Manage unavailable dates and times</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Blocked Date
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarOff className="w-5 h-5" />
                Calendar View
              </CardTitle>
              <CardDescription>
                Dates marked in red are blocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={undefined}
                className="rounded-md border"
                modifiers={{
                  blocked: getBlockedDatesForCalendar()
                }}
                modifiersStyles={{
                  blocked: {
                    backgroundColor: '#FEE2E2',
                    color: '#991B1B',
                    fontWeight: 'bold'
                  }
                }}
                disabled={(date) => date < new Date()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Blocked Dates List</CardTitle>
              <CardDescription>
                Upcoming blocked dates and times
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blockedDates.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No blocked dates</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {blockedDates.map((blockedDate) => (
                    <div key={blockedDate.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">
                          {format(parseISO(blockedDate.date), 'MMMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-600">
                          {blockedDate.isFullDay ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Full Day
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {blockedDate.startTime} - {blockedDate.endTime}
                            </span>
                          )}
                        </div>
                        {blockedDate.reason && (
                          <div className="text-xs text-gray-500 mt-1">
                            {blockedDate.reason}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(blockedDate.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blocked Date</DialogTitle>
            <DialogDescription>
              Block specific dates or time ranges from being booked
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border mt-2"
                disabled={(date) => date < new Date()}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={isFullDay}
                onCheckedChange={setIsFullDay}
                id="full-day"
              />
              <Label htmlFor="full-day">Block entire day</Label>
            </div>

            {!isFullDay && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                placeholder="e.g., Holiday, Personal day off"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBlockedDate}>
              Add Blocked Date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}