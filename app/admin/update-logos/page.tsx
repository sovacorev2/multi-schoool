'use client'

import { useEffect, useState } from 'react'
import SchoolLogoUploader from '@/components/admin/SchoolLogoUploader'

interface School {
  id: string
  name: string
  logo_url?: string
}

export default function UpdateLogosPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSchools()
  }, [])

  const fetchSchools = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/update-school-logos', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch schools: ${response.statusText}`)
      }
      
      const data = await response.json()
      setSchools(data.schools || [])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      console.error('[v0] Error:', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUploadSuccess = (schoolId: string, newLogoUrl: string) => {
    setSchools(schools.map(school => 
      school.id === schoolId 
        ? { ...school, logo_url: newLogoUrl }
        : school
    ))
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-600">Loading schools...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Manage School Logos</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {schools.map((school) => (
          <SchoolLogoUploader
            key={school.id}
            schoolId={school.id}
            schoolName={school.name}
            currentLogoUrl={school.logo_url}
            onUploadSuccess={(logoUrl) => handleLogoUploadSuccess(school.id, logoUrl)}
          />
        ))}
      </div>

      {schools.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p>No schools found</p>
        </div>
      )}
    </div>
  )
}
