'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SimpleCalendar } from '@/components/ui/simple-calendar'
import { ArrowLeft, Plus, Calendar, Trash2, Clock, Bell } from 'lucide-react'
import { format, parseISO, startOfToday } from 'date-fns'
import { formatETDateLong } from '@/lib/utils/timezone'
import { useToast } from '@/hooks/use-toast'

interface AvailableSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  reason: string | null
  createdAt: string
}

interface EligibleClient {
  phoneNumber: string
  clientName: string
}

export default function AvailableSlotsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [reason, setReason] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [alertDialogOpen, setAlertDialogOpen] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [alertFetchLoading, setAlertFetchLoading] = useState(false)
  const [eligibleClients, setEligibleClients] = useState<EligibleClient[]>([])
  const alertDialogWantedRef = useRef(false)

  useEffect(() => {
    // Don't wait for session, just fetch available slots immediately
    // Middleware has already verified we're admin
    fetchAvailableSlots()
  }, [])

  const fetchAvailableSlots = async () => {
    try {
      const response = await fetch('/api/available-slots')
      if (response.ok) {
        const data = await response.json()
        const todayStart = startOfToday()
        const toLocalDateOnly = (iso: string) => {
          const d = new Date(iso)
          return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        }
        setAvailableSlots(
          data
            .filter((slot: AvailableSlot) => toLocalDateOnly(slot.date) >= todayStart)
        )
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch available slots',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error fetching available slots:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch available slots',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddAvailableSlot = async () => {
    if (!selectedDate) {
      toast({
        title: 'Error',
        description: 'Please select a date',
        variant: 'destructive'
      })
      return
    }

    if (!startTime || !endTime) {
      toast({
        title: 'Error',
        description: 'Please select start and end times',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch('/api/available-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(selectedDate, 'yyyy-MM-dd'),
          startTime,
          endTime,
          reason: reason || null
        })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Available slot added successfully'
        })
        await fetchAvailableSlots()
        setDialogOpen(false)
        resetForm()
        // After successful slot creation, offer to alert clients
        handleOpenAlertDialog()
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add available slot',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error adding available slot:', error)
      toast({
        title: 'Error',
        description: 'Failed to add available slot',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/available-slots?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Available slot removed'
        })
        setAvailableSlots(prev => prev.filter(slot => slot.id !== id))
      } else {
        toast({
          title: 'Error',
          description: 'Failed to remove available slot',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error deleting available slot:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove available slot',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setSelectedDate(undefined)
    setStartTime('09:00')
    setEndTime('18:00')
    setReason('')
  }

  const handleBulkCreate = async () => {
    setBulkLoading(true)
    try {
      const response = await fetch('/api/available-slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (response.ok) {
        const data = await response.json()
        toast({
          title: 'Bulk slots created',
          description: `Created ${data.created ?? 0} time slot${(data.created ?? 0) === 1 ? '' : 's'}`
        })
        await fetchAvailableSlots()
        // After successful bulk creation, offer to alert clients
        if (data.created > 0) {
          handleOpenAlertDialog()
        }
      } else {
        const err = await response.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: err.error || 'Failed to bulk-create slots',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error bulk-creating slots:', error)
      toast({
        title: 'Error',
        description: 'Failed to bulk-create slots',
        variant: 'destructive'
      })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleOpenAlertDialog = async () => {
    alertDialogWantedRef.current = true
    setAlertFetchLoading(true)
    try {
      const response = await fetch('/api/availability-alert?includeDetails=true')
      if (response.ok) {
        const data = await response.json()
        // Only open if still wanted (user didn't close during fetch)
        if (alertDialogWantedRef.current) {
          setEligibleClients(data.clients || [])
          setAlertDialogOpen(true)
        }
      } else {
        if (alertDialogWantedRef.current) {
          toast({
            title: 'Error',
            description: 'Failed to fetch eligible clients',
            variant: 'destructive'
          })
        }
      }
    } catch (error) {
      console.error('Error fetching eligible clients:', error)
      if (alertDialogWantedRef.current) {
        toast({
          title: 'Error',
          description: 'Failed to fetch eligible clients',
          variant: 'destructive'
        })
      }
    } finally {
      setAlertFetchLoading(false)
    }
  }

  // Format phone number for display (phone is already masked from API as "***-***-XXXX")
  const formatPhoneDisplay = (phone: string) => {
    return phone || ''
  }

  const handleSendAlerts = async () => {
    setAlertLoading(true)
    try {
      const response = await fetch('/api/availability-alert', {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        if (data.dryRun) {
          toast({
            title: 'Dry Run Complete',
            description: `Would have sent to ${data.sent} client${data.sent === 1 ? '' : 's'}`
          })
          setAlertDialogOpen(false)
        } else if (data.failed > 0) {
          // Keep dialog open when some alerts failed so admin can see the issue
          toast({
            title: 'Partial Success',
            description: `Sent to ${data.sent} client${data.sent === 1 ? '' : 's'}, ${data.failed} failed`,
            variant: 'destructive'
          })
        } else {
          toast({
            title: 'Alerts Sent',
            description: `Sent to ${data.sent} client${data.sent === 1 ? '' : 's'}`
          })
          setAlertDialogOpen(false)
        }
      } else {
        const err = await response.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: err.error || 'Failed to send alerts',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error sending alerts:', error)
      toast({
        title: 'Error',
        description: 'Failed to send alerts',
        variant: 'destructive'
      })
    } finally {
      setAlertLoading(false)
    }
  }

  const getAvailableDatesForCalendar = () => {
    return availableSlots.map(slot => {
      const d = new Date(slot.date)
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
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
              <h1 className="text-2xl font-bold">Available Time Slots</h1>
              <p className="text-gray-600">Define when customers can book appointments</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Available Slot
          </Button>
        </div>

        {/* Bulk tools */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Create Slots</CardTitle>
              <CardDescription>
                Duplicate this week&apos;s remaining shifts to the next available week. Press repeatedly to extend further.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleBulkCreate} disabled={bulkLoading}>
                {bulkLoading ? 'Creating…' : 'Bulk Create for Next Week'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Only upcoming shifts from this week are duplicated to the next week without existing slots. Days with slots are skipped.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Alert Recurring Clients
              </CardTitle>
              <CardDescription>
                Send a text message to clients with 2+ appointments in the past 6 months.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleOpenAlertDialog} variant="secondary" disabled={alertFetchLoading}>
                <Bell className="w-4 h-4 mr-2" />
                {alertFetchLoading ? 'Loading…' : 'Alert Clients of New Availability'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Clients are limited to 1 alert per day to prevent spam.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Calendar View
              </CardTitle>
              <CardDescription>
                Dates marked in green have available slots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleCalendar
                selected={undefined}
                className="rounded-md border"
                disabled={(date) => date < startOfToday()}
                availableDates={getAvailableDatesForCalendar()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Slots List</CardTitle>
              <CardDescription>
                Upcoming available time windows
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableSlots.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No available slots configured</p>
                  <p className="text-sm text-gray-400 mt-2">Add time slots to allow bookings</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex-1">
                        <div className="font-medium">
                          {(() => {
                            return formatETDateLong(slot.date)
                          })()}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>
                        {slot.reason && (
                          <div className="text-xs text-gray-500 mt-1">
                            {slot.reason}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(slot.id)}
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
            <DialogTitle>Add Available Time Slot</DialogTitle>
            <DialogDescription>
              Define a time window when customers can book appointments
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Date</Label>
              <SimpleCalendar
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border mt-2"
                disabled={(date) => date < startOfToday()}
              />
            </div>

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

            <div>
              <Label htmlFor="reason">Note (optional)</Label>
              <Input
                id="reason"
                placeholder="e.g., Extended hours, Special availability"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAvailableSlot}>
              Add Available Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={alertDialogOpen} onOpenChange={(open) => {
        if (!open) {
          alertDialogWantedRef.current = false
        }
        setAlertDialogOpen(open)
        if (!open) {
          setEligibleClients([])
          setAlertLoading(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Alert Recurring Clients
            </DialogTitle>
            <DialogDescription>
              Send a text message to notify recurring clients about new availability.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {eligibleClients.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No eligible clients to notify. Clients need 2+ appointments in the past 6 months and must not have been notified today.
              </p>
            ) : (
              <div>
                <p className="text-center mb-4">
                  <span className="text-2xl font-bold text-primary">{eligibleClients.length}</span>
                  <span className="text-muted-foreground ml-2">
                    recurring client{eligibleClients.length === 1 ? '' : 's'} will receive a text message
                  </span>
                </p>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {eligibleClients.map((client, index) => (
                    <div key={index} className="px-3 py-2 flex justify-between items-center">
                      <span className="font-medium">{client.clientName}</span>
                      <span className="text-sm text-muted-foreground">{formatPhoneDisplay(client.phoneNumber)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendAlerts}
              disabled={alertLoading || eligibleClients.length === 0}
            >
              {alertLoading ? 'Sending…' : `Send Alert${eligibleClients.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
