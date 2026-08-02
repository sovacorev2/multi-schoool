'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Save } from 'lucide-react'
import type { Class } from '@/lib/types'
import { TeachersUnified } from '@/components/teachers-unified'
import { useAdminSchool } from '../_shared/AdminSchoolContext'
import { sortClasses } from '../_shared/utils'

export default function TeachersPage() {
  const { currentSchool } = useSchool()
  const { school } = useAdminSchool()

  const [classes, setClasses] = useState<Class[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [classTeachers, setClassTeachers] = useState<{ [key: string]: string }>({})
  const [teacherUpdateSuccess, setTeacherUpdateSuccess] = useState('')

  const loadClasses = useCallback(async () => {
    if (!currentSchool) return
    setIsLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('classes').select('*').eq('school_id', currentSchool.id).order('display_order')
    if (data) setClasses(sortClasses(data as Class[]))
    setIsLoading(false)
  }, [currentSchool?.id])

  useEffect(() => { loadClasses() }, [loadClasses])

  const updateClassTeacher = async (classId: string) => {
    const teacherName = classTeachers[classId]
    const supabase = createClient()
    const { error } = await supabase
      .from('classes')
      .update({ teacher_name: teacherName?.trim() || null })
      .eq('id', classId)

    if (!error) {
      setTeacherUpdateSuccess('Class teacher updated successfully!')
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, teacher_name: teacherName?.trim() || null } : c))
      setTimeout(() => setTeacherUpdateSuccess(''), 3000)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Assign Class Teachers
          </CardTitle>
          <CardDescription>Set the class teacher for each class (shown on report cards)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {teacherUpdateSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {teacherUpdateSuccess}
            </div>
          )}

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
                    <th className="p-3 text-left">Current Teacher</th>
                    <th className="p-3 text-left">Teacher Name</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortClasses(classes).map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">
                        <span className={c.teacher_name ? 'text-green-600 font-medium' : 'text-gray-400 italic'}>
                          {c.teacher_name || 'Not assigned'}
                        </span>
                      </td>
                      <td className="p-3">
                        <Input
                          type="text"
                          placeholder="Enter teacher name"
                          value={classTeachers[c.id] ?? c.teacher_name ?? ''}
                          onChange={(e) => setClassTeachers(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="w-56"
                        />
                      </td>
                      <td className="p-3">
                        <Button size="sm" onClick={() => updateClassTeacher(c.id)}>
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-sm text-gray-500">
            The class teacher name will appear on student report cards for CBC primary schools.
          </p>
        </CardContent>
      </Card>

      {school?.feature_pin_management && (
        <TeachersUnified
          schoolId={currentSchool?.id || ''}
          schoolName={currentSchool?.name || ''}
          whatsappEnabled={currentSchool?.feature_whatsapp_reports === true}
        />
      )}
    </div>
  )
}
