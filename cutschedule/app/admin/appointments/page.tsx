'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Search, Calendar, Phone, User, Clock, X, CheckCircle, XCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

interface Appointment {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  startTime: string
  endTime: string
  status: string
  createdAt: string
}

export default function AppointmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  useEffect(() => {
    // Don't wait for session, just fetch appointments immediately
    // Middleware has already verified we're admin
    fetchAppointments()
  }, [])

  useEffect(() => {
    filterAppointments()
  }, [appointments, searchTerm, statusFilter])

  const fetchAppointments = async () => {
    try {
      const response = await fetch('/api/appointments')
      if (response.ok) {
        const data = await response.json()
        setAppointments(data.sort((a: Appointment, b: Appointment) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        ))
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch appointments',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch appointments',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const filterAppointments = () => {
    let filtered = [...appointments]

    // Filter by search term (name or phone)
    if (searchTerm) {
      filtered = filtered.filter(apt =>
        apt.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.phoneNumber.includes(searchTerm)
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter)
    }

    setFilteredAppointments(filtered)
  }

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return

    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Appointment cancelled successfully'
        })

        // Update local state
        setAppointments(prev =>
          prev.map(apt =>
            apt.id === selectedAppointment.id
              ? { ...apt, status: 'cancelled' }
              : apt
          )
        )

        setCancelDialogOpen(false)
        setSelectedAppointment(null)
      } else {
        toast({
          title: 'Error',
          description: 'Failed to cancel appointment',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error)
      toast({
        title: 'Error',
        description: 'Failed to cancel appointment',
        variant: 'destructive'
      })
    }
  }

  const handleMarkCompleted = async (appointment: Appointment) => {
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Appointment marked as completed'
        })

        // Update local state
        setAppointments(prev =>
          prev.map(apt =>
            apt.id === appointment.id
              ? { ...apt, status: 'completed' }
              : apt
          )
        )
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update appointment',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
      toast({
        title: 'Error',
        description: 'Failed to update appointment',
        variant: 'destructive'
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Confirmed</span>
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Cancelled</span>
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Completed</span>
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>
    }
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
      <div className="max-w-7xl mx-auto">
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
              <h1 className="text-2xl font-bold">Appointments</h1>
              <p className="text-gray-600">Manage all appointments</p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appointments ({filteredAppointments.length})</CardTitle>
            <CardDescription>
              Showing {filteredAppointments.length} of {appointments.length} appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No appointments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {format(parseISO(appointment.date), 'MMM d, yyyy')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(parseISO(appointment.startTime), 'h:mm a')} - {format(parseISO(appointment.endTime), 'h:mm a')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            {appointment.clientName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {appointment.phoneNumber}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {appointment.status === 'confirmed' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkCompleted(appointment)}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedAppointment(appointment)
                                    setCancelDialogOpen(true)
                                  }}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? This will send a cancellation SMS to the client.
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-2 py-4">
              <p><strong>Client:</strong> {selectedAppointment.clientName}</p>
              <p><strong>Date:</strong> {format(parseISO(selectedAppointment.date), 'MMMM d, yyyy')}</p>
              <p><strong>Time:</strong> {format(parseISO(selectedAppointment.startTime), 'h:mm a')}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Appointment
            </Button>
            <Button variant="destructive" onClick={handleCancelAppointment}>
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}