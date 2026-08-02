'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, History, Bell, Send } from 'lucide-react'
import type { Class } from '@/lib/types'
import type { AuditLog } from '../_shared/types'
import SchoolLogoUploader from '@/components/admin/SchoolLogoUploader'
import { useAdminSchool } from '../_shared/AdminSchoolContext'
import { sortClasses } from '../_shared/utils'

export default function SettingsReportsPage() {
  const { currentSchool, setCurrentSchool } = useSchool()
  const { school, setSchool } = useAdminSchool()

  const [classes, setClasses] = useState<Class[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Notifications
  const [notificationMessage, setNotificationMessage] = useState('')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [notificationAllClasses, setNotificationAllClasses] = useState(false)
  const [notificationSending, setNotificationSending] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [notificationSuccess, setNotificationSuccess] = useState('')

  const loadData = useCallback(async () => {
    if (!currentSchool) return
    setIsLoading(true)
    const supabase = createClient()
    const [classesRes, logsRes] = await Promise.all([
      supabase.from('classes').select('id, name, display_order').eq('school_id', currentSchool.id).order('display_order'),
      supabase.from('activity_logs').select('*').eq('school_id', currentSchool.id).order('created_at', { ascending: false }).limit(100),
    ])
    if (classesRes.data) setClasses(sortClasses(classesRes.data as Class[]))
    if (logsRes.data) setAuditLogs(logsRes.data as AuditLog[])
    setIsLoading(false)
  }, [currentSchool?.id])

  useEffect(() => { loadData() }, [loadData])

  const updateSchoolSettings = async () => {
    if (!school) return
    const supabase = createClient()
    const { error } = await supabase
      .from('schools')
      .update({
        name: school.name,
        short_name: school.short_name,
        tagline: school.tagline,
        email: school.email,
        phone: school.phone,
        address: school.address,
        primary_color: school.primary_color,
      })
      .eq('id', school.id)

    if (!error) {
      setCurrentSchool(school as any)
      alert('School settings updated successfully!')
      await supabase.from('activity_logs').insert({
        school_id: school.id,
        action: 'school_settings_updated',
        details: 'Updated school information: name, contact, address, color',
        performed_by: 'Admin Portal',
      })
    } else {
      alert('Failed to update school settings: ' + error.message)
    }
  }

  const sendNotification = async () => {
    setNotificationError('')
    setNotificationSuccess('')

    if (!notificationMessage.trim()) {
      setNotificationError('Please enter a message')
      return
    }
    if (!notificationAllClasses && selectedClasses.length === 0) {
      setNotificationError('Please select at least one class or choose "Send to All Classes"')
      return
    }

    try {
      setNotificationSending(true)
      const targetClasses = notificationAllClasses ? classes.map(c => c.id) : selectedClasses

      const res = await fetch('/api/admin/send-bulk-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: school?.id, message: notificationMessage, classIds: targetClasses }),
      })
      const data = await res.json()

      if (data.success) {
        setNotificationSuccess(data.message || `Notification sent to ${data.totalRecipients} parent${data.totalRecipients !== 1 ? 's' : ''}`)
        setNotificationMessage('')
        setSelectedClasses([])
        setNotificationAllClasses(false)
      } else {
        setNotificationError(data.error || 'Failed to send notification')
      }
    } catch (error: any) {
      setNotificationError(error.message || 'Error sending notification')
    } finally {
      setNotificationSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {school && (
        <Card>
          <CardHeader>
            <CardTitle>School Logo</CardTitle>
            <CardDescription>Upload and manage your school's logo</CardDescription>
          </CardHeader>
          <CardContent>
            <SchoolLogoUploader
              schoolId={school.id}
              schoolName={school.name}
              currentLogoUrl={school.logo_url ?? undefined}
              onUploadSuccess={(logoUrl) => setSchool({ ...school, logo_url: logoUrl })}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            School Information
          </CardTitle>
          <CardDescription>Update school information and branding</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {school && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">School Name</label>
                  <Input value={school.name} onChange={(e) => setSchool({ ...school, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Short Name</label>
                  <Input value={school.short_name || ''} onChange={(e) => setSchool({ ...school, short_name: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tagline / Motto</label>
                <Input value={school.tagline || ''} onChange={(e) => setSchool({ ...school, tagline: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={school.email || ''} onChange={(e) => setSchool({ ...school, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={school.phone || ''} onChange={(e) => setSchool({ ...school, phone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Input value={school.address || ''} onChange={(e) => setSchool({ ...school, address: e.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={school.primary_color || '#2563eb'}
                    onChange={(e) => setSchool({ ...school, primary_color: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input value={school.primary_color || '#2563eb'} onChange={(e) => setSchool({ ...school, primary_color: e.target.value })} className="w-32" />
                </div>
              </div>

              <Button onClick={updateSchoolSettings} className="w-full">
                Save Settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Audit Logs
          </CardTitle>
          <CardDescription>View all actions performed in the system with precise PIN identification</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No audit logs yet</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="border rounded-lg p-4 bg-white hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm capitalize bg-blue-600 text-white px-3 py-1 rounded">
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="bg-yellow-100 border border-yellow-400 p-2 rounded">
                        <p className="text-sm font-mono font-bold text-yellow-800">
                          Teacher PIN: {log.teacher_pin || 'Unknown'}
                        </p>
                      </div>
                      {log.details && (
                        <p className="text-sm text-gray-700">
                          {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{new Date(log.created_at).toLocaleDateString()}</p>
                      <p>{new Date(log.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {school?.feature_bulk_sms && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Custom Notifications
            </CardTitle>
            <CardDescription>
              Send bulk SMS notifications to parents in selected classes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="notification-message" className="text-base font-medium">Message</Label>
              <textarea
                id="notification-message"
                placeholder="Enter your custom message for parents..."
                value={notificationMessage}
                onChange={(e) => {
                  setNotificationMessage(e.target.value)
                  setNotificationError('')
                  setNotificationSuccess('')
                }}
                className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
              <p className="text-xs text-gray-500">{notificationMessage.length} characters</p>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Send To</Label>

              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-900/50 cursor-pointer">
                <input
                  type="checkbox"
                  id="all-classes"
                  checked={notificationAllClasses}
                  onChange={(e) => {
                    setNotificationAllClasses(e.target.checked)
                    if (e.target.checked) setSelectedClasses([])
                  }}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="all-classes" className="flex-1 cursor-pointer">
                  <p className="font-medium text-gray-700 dark:text-gray-300">Send to All Classes</p>
                  <p className="text-xs text-gray-500">Reaches parents in all classes of the school</p>
                </label>
              </div>

              {!notificationAllClasses && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Or select specific classes:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg p-3 dark:border-slate-700">
                    {sortClasses(classes).map(cls => (
                      <div key={cls.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`class-${cls.id}`}
                          checked={selectedClasses.includes(cls.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedClasses([...selectedClasses, cls.id])
                            else setSelectedClasses(selectedClasses.filter(id => id !== cls.id))
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor={`class-${cls.id}`} className="text-sm cursor-pointer">
                          {cls.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Selected: {selectedClasses.length} class(es)</p>
                </div>
              )}
            </div>

            {notificationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
                {notificationError}
              </div>
            )}
            {notificationSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
                {notificationSuccess}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={sendNotification}
                disabled={notificationSending || !notificationMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                {notificationSending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Notification
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNotificationMessage('')
                  setSelectedClasses([])
                  setNotificationAllClasses(false)
                  setNotificationError('')
                  setNotificationSuccess('')
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
