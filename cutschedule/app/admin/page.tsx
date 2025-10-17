'use client'

import { useSession, signOut } from 'next-auth/react'
// import Link from 'next/link'
import { LinkButton } from '@/components/ui/link-button'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, Users, Phone, LogOut, Settings } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatETTime, formatETDateShort, isETToday, isETTomorrow, etDaysFromToday } from '@/lib/utils/timezone'
import { APP_CONFIG } from '@/lib/constants'

interface Appointment {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  startTime: string
  endTime: string
  status: string
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    today: 0,
    tomorrow: 0,
    thisWeek: 0,
    total: 0
  })

  useEffect(() => {
    // Don't wait for session, just fetch appointments immediately
    // Middleware has already verified we're admin
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      const response = await fetch('/api/appointments')
      if (response.ok) {
        const data = await response.json()
        setAppointments(data.filter((apt: Appointment) => apt.status !== 'cancelled'))

        // Calculate stats
        const todayAppts = data.filter((apt: Appointment) =>
          apt.status === 'confirmed' && isETToday(apt.startTime)
        ).length

        const tomorrowAppts = data.filter((apt: Appointment) =>
          apt.status === 'confirmed' && isETTomorrow(apt.startTime)
        ).length

        const thisWeekAppts = data.filter((apt: Appointment) => {
          const daysDiff = etDaysFromToday(apt.startTime)
          return apt.status === 'confirmed' && daysDiff >= 0 && daysDiff <= 7
        }).length

        setStats({
          today: todayAppts,
          tomorrow: tomorrowAppts,
          thisWeek: thisWeekAppts,
          total: data.filter((apt: Appointment) => apt.status === 'confirmed').length
        })
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/admin/login' })
  }

  const getAppointmentStatus = (apt: Appointment) => {
    if (isETToday(apt.startTime)) return 'Today'
    if (isETTomorrow(apt.startTime)) return 'Tomorrow'
    return formatETDateShort(apt.startTime)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }


  const todayAppointments = appointments
    .filter(apt => apt.status === 'confirmed' && isETToday(apt.startTime))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const upcomingAppointments = appointments
    .filter(apt => {
      const daysDiff = etDaysFromToday(apt.startTime)
      return apt.status === 'confirmed' && daysDiff > 0 && daysDiff <= 7
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CutSchedule Admin</h1>
              <p className="text-sm text-gray-600">Welcome back, {session?.user?.name || 'Admin'}</p>
            </div>
            <div className="flex items-center space-x-4">
              <LinkButton href="/admin/settings" variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </LinkButton>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground">
                {stats.today === 1 ? 'appointment' : 'appointments'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tomorrow</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tomorrow}</div>
              <p className="text-xs text-muted-foreground">
                {stats.tomorrow === 1 ? 'appointment' : 'appointments'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisWeek}</div>
              <p className="text-xs text-muted-foreground">
                {stats.thisWeek === 1 ? 'appointment' : 'appointments'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Active</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                confirmed {stats.total === 1 ? 'appointment' : 'appointments'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Today's Appointments */}
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Appointments</CardTitle>
              <CardDescription>
                {todayAppointments.length} {todayAppointments.length === 1 ? 'appointment' : 'appointments'} scheduled for today
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No appointments today</p>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{appointment.clientName}</p>
                        <p className="text-sm text-gray-600 flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {appointment.phoneNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatETTime(appointment.startTime)}</p>
                        <p className="text-xs text-gray-500">{APP_CONFIG.APPOINTMENT_DURATION} min</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
              <CardDescription>
                Next 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No upcoming appointments</p>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.slice(0, 5).map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{appointment.clientName}</p>
                        <p className="text-sm text-gray-600">{getAppointmentStatus(appointment)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatETTime(appointment.startTime)}</p>
                        <p className="text-xs text-gray-500">{appointment.phoneNumber}</p>
                      </div>
                    </div>
                  ))}
                  {upcomingAppointments.length > 5 && (
                    <p className="text-sm text-gray-500 text-center pt-2">
                      +{upcomingAppointments.length - 5} more appointments
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <LinkButton href="/admin/appointments" variant="outline" className="h-16">
                  <div className="text-center">
                    <Calendar className="w-6 h-6 mx-auto mb-1" />
                    <p className="text-sm">View All Appointments</p>
                  </div>
                </LinkButton>
                {/** Working Hours removed in favor of Available Slots as single source of truth **/}
                <LinkButton href="/admin/available-slots" variant="outline" className="h-16">
                  <div className="text-center">
                    <Calendar className="w-6 h-6 mx-auto mb-1" />
                    <p className="text-sm">Available Time Slots</p>
                  </div>
                </LinkButton>
                <LinkButton href="/admin/sms-logs" variant="outline" className="h-16">
                  <div className="text-center">
                    <Phone className="w-6 h-6 mx-auto mb-1" />
                    <p className="text-sm">SMS Logs</p>
                  </div>
                </LinkButton>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
