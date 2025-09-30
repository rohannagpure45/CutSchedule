'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Save, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WorkingHours {
  id: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function WorkingHoursPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user?.isAdmin) {
      router.push('/admin/login')
      return
    }

    fetchWorkingHours()
  }, [session, status, router])

  const fetchWorkingHours = async () => {
    try {
      const response = await fetch('/api/working-hours')
      if (response.ok) {
        const data = await response.json()
        setWorkingHours(data)
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch working hours',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error fetching working hours:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch working hours',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTimeChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setWorkingHours(prev =>
      prev.map(day =>
        day.dayOfWeek === dayIndex
          ? { ...day, [field]: value }
          : day
      )
    )
  }

  const handleActiveChange = (dayIndex: number, isActive: boolean) => {
    setWorkingHours(prev =>
      prev.map(day =>
        day.dayOfWeek === dayIndex
          ? { ...day, isActive }
          : day
      )
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/working-hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: workingHours })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Working hours updated successfully'
        })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update working hours',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error saving working hours:', error)
      toast({
        title: 'Error',
        description: 'Failed to update working hours',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const applyToWeekdays = () => {
    const monday = workingHours.find(d => d.dayOfWeek === 1)
    if (!monday) return

    setWorkingHours(prev =>
      prev.map(day => {
        if (day.dayOfWeek >= 1 && day.dayOfWeek <= 5) {
          return {
            ...day,
            startTime: monday.startTime,
            endTime: monday.endTime,
            isActive: monday.isActive
          }
        }
        return day
      })
    )

    toast({
      title: 'Applied',
      description: 'Monday hours applied to all weekdays'
    })
  }

  if (status === 'loading' || loading) {
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
      <div className="max-w-4xl mx-auto">
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
              <h1 className="text-2xl font-bold">Working Hours</h1>
              <p className="text-gray-600">Configure business hours for each day</p>
            </div>
          </div>
          <Button onClick={applyToWeekdays} variant="outline" size="sm">
            Apply Monday to Weekdays
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Business Hours
            </CardTitle>
            <CardDescription>
              Set the working hours for each day of the week
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workingHours.map((day) => (
              <div key={day.dayOfWeek} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-32">
                  <Label className="font-medium">{daysOfWeek[day.dayOfWeek]}</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={day.isActive}
                    onCheckedChange={(checked) => handleActiveChange(day.dayOfWeek, checked)}
                  />
                  <Label className="text-sm text-gray-600">
                    {day.isActive ? 'Open' : 'Closed'}
                  </Label>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`start-${day.dayOfWeek}`} className="text-sm">From</Label>
                    <Input
                      id={`start-${day.dayOfWeek}`}
                      type="time"
                      value={day.startTime}
                      onChange={(e) => handleTimeChange(day.dayOfWeek, 'startTime', e.target.value)}
                      disabled={!day.isActive}
                      className="w-32"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor={`end-${day.dayOfWeek}`} className="text-sm">To</Label>
                    <Input
                      id={`end-${day.dayOfWeek}`}
                      type="time"
                      value={day.endTime}
                      onChange={(e) => handleTimeChange(day.dayOfWeek, 'endTime', e.target.value)}
                      disabled={!day.isActive}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" onClick={() => router.push('/admin')}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}