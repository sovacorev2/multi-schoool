'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, GraduationCap, Shield, Save } from 'lucide-react'
import type { Class } from '@/lib/types'
import { sortClasses } from '../_shared/utils'

export default function AccessPasswordsPage() {
  const { currentSchool } = useSchool()

  const [classes, setClasses] = useState<Class[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [classPasswords, setClassPasswords] = useState<{ [key: string]: string }>({})
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('')
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState('')

  const loadClasses = useCallback(async () => {
    if (!currentSchool) return
    setIsLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('classes').select('*').eq('school_id', currentSchool.id).order('display_order')
    if (data) setClasses(sortClasses(data as Class[]))
    setIsLoading(false)
  }, [currentSchool?.id])

  useEffect(() => { loadClasses() }, [loadClasses])

  const updateClassPassword = async (classId: string) => {
    const newPassword = classPasswords[classId]
    if (!newPassword || !newPassword.trim()) return

    const supabase = createClient()
    const { error } = await supabase.from('classes').update({ password: newPassword.trim() }).eq('id', classId)

    if (!error) {
      setPasswordUpdateSuccess('Password updated for class successfully!')
      setClassPasswords(prev => ({ ...prev, [classId]: '' }))
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, password: newPassword.trim() } : c))
      setTimeout(() => setPasswordUpdateSuccess(''), 3000)
    }
  }

  const updateAdminPassword = async () => {
    if (!newAdminPassword || !currentSchool) return
    if (newAdminPassword !== confirmAdminPassword) {
      alert('Passwords do not match!')
      return
    }
    if (newAdminPassword.length < 4) {
      alert('Password must be at least 4 characters!')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('schools').update({ admin_password: newAdminPassword }).eq('id', currentSchool.id)

    if (!error) {
      setPasswordUpdateSuccess('Admin password updated successfully!')
      setNewAdminPassword('')
      setConfirmAdminPassword('')
      setTimeout(() => setPasswordUpdateSuccess(''), 3000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Manage Passwords
        </CardTitle>
        <CardDescription>Set or change passwords for classes and admin access</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {passwordUpdateSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {passwordUpdateSuccess}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-medium text-gray-700 flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Class Passwords
          </h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Class</th>
                    <th className="p-3 text-left">Current Password</th>
                    <th className="p-3 text-left">New Password</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortClasses(classes).map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                          {c.password || 'Not set'}
                        </code>
                      </td>
                      <td className="p-3">
                        <Input
                          type="text"
                          placeholder="Enter new password"
                          value={classPasswords[c.id] || ''}
                          onChange={(e) => setClassPasswords(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="w-48"
                        />
                      </td>
                      <td className="p-3">
                        <Button size="sm" onClick={() => updateClassPassword(c.id)} disabled={!classPasswords[c.id]?.trim()}>
                          <Save className="w-4 h-4 mr-1" />
                          Update
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium text-gray-700 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Admin Portal Password
          </h3>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
            <p className="text-sm text-amber-700">
              This password is used to access this Admin Portal. Change it carefully.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Admin Password</label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={updateAdminPassword}
              disabled={!newAdminPassword || !confirmAdminPassword}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Lock className="w-4 h-4 mr-2" />
              Update Admin Password
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
