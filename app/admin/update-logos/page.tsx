'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function UpdateLogosPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUpdateLogos = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/update-school-logos', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update logos: ${response.statusText}`)
      }
      
      const data = await response.json()
      setResult(data)
      console.log('✓ Logos updated:', data)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      console.error('✗ Error:', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Update School Logos</h1>
      
      <Button 
        onClick={handleUpdateLogos}
        disabled={loading}
        className="mb-6"
      >
        {loading ? 'Updating...' : 'Update Logos'}
      </Button>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <p className="font-bold mb-4">{result.message}</p>
          <div className="space-y-2">
            {result.schools?.map((school: any) => (
              <div key={school.id} className="flex justify-between">
                <span className="font-semibold">{school.name}:</span>
                <span className={school.logo_url ? 'text-green-600' : 'text-red-600'}>
                  {school.logo_url ? '✓ ' + school.logo_url : '✗ NO LOGO'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
