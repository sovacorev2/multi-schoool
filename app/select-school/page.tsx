'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSchool, type School } from '@/lib/school-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { School as SchoolIcon, ChevronRight, Plus } from 'lucide-react'
import Image from 'next/image'

export default function SchoolSelectionPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  
  const router = useRouter()
  const { currentSchool } = useSchool()

  // If school already selected, redirect to their system with proper URL
  useEffect(() => {
    if (currentSchool) {
      router.push(`/?school=${currentSchool.code}`)
    }
  }, [currentSchool, router])

  useEffect(() => {
    async function fetchSchools() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('schools')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (error) throw error
        setSchools(data || [])
      } catch (err) {
        setError('Failed to load schools. Please try again.')
        console.error('[v0] Fetch schools error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSchools()
  }, [])

  const handleSelectSchool = (school: School) => {
    // Redirect to school's system using proper URL format with school code
    router.push(`/?school=${school.code}`)
  }

  if (currentSchool) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <SchoolIcon className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Management System</h1>
          <p className="text-gray-600">Select your school to continue</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            Loading schools...
          </div>
        ) : schools.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No schools available. Please contact the administrator.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {schools.map((school) => (
              <Card 
                key={school.id} 
                className="shadow-md hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-300"
                onClick={() => handleSelectSchool(school)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center relative">
                      <Image
                        src={school.logo_url || `/logos/${school.code}.jpeg`}
                        alt={`${school.name} logo`}
                        fill
                        className="object-contain"
                        onError={(e) => {
                          // Fallback to initials if logo fails to load
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `<span class="text-white font-bold text-lg">${school.short_name?.substring(0, 2) || school.name.substring(0, 2).toUpperCase()}</span>`
                            parent.style.backgroundColor = school.primary_color || '#2563eb'
                          }
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">{school.name}</h3>
                      {school.tagline && (
                        <p className="text-sm text-gray-500 italic">{school.tagline}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add New School Button */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/setup-school')}
            className="border-dashed border-2 hover:border-blue-400 hover:bg-blue-50"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add New School
          </Button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Multi-School Exam Management System
        </p>
      </div>
    </div>
  )
}
