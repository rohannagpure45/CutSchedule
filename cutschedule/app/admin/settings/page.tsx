"use client"

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react'

export default function AdminSettingsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-gray-600">Manage admin and app settings</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              This is a placeholder. Add settings as needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              No configurable settings yet. If you have specific settings in mind
              (notifications, business info, integrations), let me know and I can add them here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

