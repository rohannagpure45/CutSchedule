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
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Search, Phone, MessageCircle, Calendar, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatETDateTimeShort } from '@/lib/utils/timezone'
import { useToast } from '@/hooks/use-toast'

interface SMSLog {
  id: string
  appointmentId: string
  phoneNumber: string
  messageType: string
  sentAt: string
  status: string
  twilioSid: string | null
}

export default function SMSLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<SMSLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [messageTypeFilter, setMessageTypeFilter] = useState('all')

  useEffect(() => {
    // Don't wait for session, just fetch SMS logs immediately
    // Middleware has already verified we're admin
    fetchSMSLogs()
  }, [])

  useEffect(() => {
    filterLogs()
  }, [smsLogs, searchTerm, statusFilter, messageTypeFilter])

  const fetchSMSLogs = async () => {
    try {
      const response = await fetch('/api/sms?limit=100')
      if (response.ok) {
        const data = await response.json()
        setSmsLogs(data)
        setFilteredLogs(data)
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch SMS logs',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching SMS logs:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch SMS logs',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const filterLogs = () => {
    let filtered = [...smsLogs]

    // Filter by search term (phone number or appointment ID)
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.phoneNumber.includes(searchTerm) ||
        log.appointmentId.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter)
    }

    // Filter by message type
    if (messageTypeFilter !== 'all') {
      filtered = filtered.filter(log => log.messageType === messageTypeFilter)
    }

    setFilteredLogs(filtered)
  }

  const getMessageTypeBadge = (type: string) => {
    const typeMap: { [key: string]: { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } } = {
      'confirmation': { label: 'Confirmation', variant: 'default' },
      'reminder_1day': { label: '1 Day Reminder', variant: 'secondary' },
      'reminder_1hour': { label: '1 Hour Reminder', variant: 'outline' },
      'reschedule_2weeks': { label: '2 Week Reschedule', variant: 'destructive' },
      'reschedule_3weeks': { label: '3 Week Reschedule', variant: 'destructive' },
    }
    const config = typeMap[type] || { label: type, variant: 'default' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getStatusIcon = (status: string) => {
    if (status === 'sent') {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    } else if (status === 'failed') {
      return <XCircle className="w-4 h-4 text-red-500" />
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/admin')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">SMS Logs</h1>
                  <p className="text-sm text-gray-600">View all SMS messages sent to clients</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSMSLogs}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>SMS History</CardTitle>
            <CardDescription>
              {filteredLogs.length} {filteredLogs.length === 1 ? 'message' : 'messages'} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <Label htmlFor="search" className="sr-only">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by phone or appointment ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status-filter" className="sr-only">
                  Status Filter
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="type-filter" className="sr-only">
                  Message Type Filter
                </Label>
                <Select value={messageTypeFilter} onValueChange={setMessageTypeFilter}>
                  <SelectTrigger id="type-filter">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="confirmation">Confirmation</SelectItem>
                    <SelectItem value="reminder_1day">1 Day Reminder</SelectItem>
                    <SelectItem value="reminder_1hour">1 Hour Reminder</SelectItem>
                    <SelectItem value="reschedule_2weeks">2 Week Reschedule</SelectItem>
                    <SelectItem value="reschedule_3weeks">3 Week Reschedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setMessageTypeFilter('all')
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Message Type</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Appointment ID</TableHead>
                    <TableHead>Twilio SID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No SMS logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <span className="capitalize text-sm">{log.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {log.phoneNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getMessageTypeBadge(log.messageType)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatETDateTimeShort(log.sentAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {log.appointmentId.slice(0, 8)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          {log.twilioSid ? (
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {log.twilioSid.slice(0, 10)}...
                            </code>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary */}
            {filteredLogs.length > 0 && (
              <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
                <div className="flex gap-4">
                  <span>
                    Total: <strong>{filteredLogs.length}</strong>
                  </span>
                  <span>
                    Sent: <strong className="text-green-600">
                      {filteredLogs.filter(l => l.status === 'sent').length}
                    </strong>
                  </span>
                  <span>
                    Failed: <strong className="text-red-600">
                      {filteredLogs.filter(l => l.status === 'failed').length}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
