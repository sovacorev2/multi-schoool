'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import Image from 'next/image'

interface SchoolLogoUploaderProps {
  schoolId: string
  schoolName: string
  currentLogoUrl?: string
  onUploadSuccess?: (logoUrl: string) => void
}

export default function SchoolLogoUploader({
  schoolId,
  schoolName,
  currentLogoUrl,
  onUploadSuccess
}: SchoolLogoUploaderProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // Convert filename to serve URL if needed
  const getDisplayUrl = (url?: string) => {
    if (!url) return undefined
    // If it's already a serve URL, use as-is
    if (url.startsWith('/api/')) return url
    // If it's a filename, convert to serve URL
    if (url.startsWith('school-logos/')) {
      return `/api/admin/logo/${encodeURIComponent(url)}`
    }
    return url
  }
  
  const [logoUrl, setLogoUrl] = useState(() => getDisplayUrl(currentLogoUrl))

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('schoolId', schoolId)

      const response = await fetch('/api/admin/upload-school-logo', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload logo')
      }

      const data = await response.json()
      setLogoUrl(data.logoUrl)
      setSuccess(true)
      
      if (onUploadSuccess) {
        onUploadSuccess(data.logoUrl)
      }

      // Reset file input
      if (e.target) {
        e.target.value = ''
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      console.error('[v0] Upload error:', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold mb-3">{schoolName} Logo</h3>
        
        {/* Current Logo Preview */}
        {logoUrl && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Current Logo:</p>
            <div className="relative w-32 h-32 bg-white border rounded">
              <Image
                src={logoUrl}
                alt={`${schoolName} logo`}
                fill
                className="object-contain p-2"
              />
            </div>
          </div>
        )}

        {/* Upload Input */}
        <div className="space-y-2">
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50"
            />
          </label>
          <p className="text-xs text-gray-500">PNG, JPG, or GIF (Max 5MB)</p>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          <p className="text-sm">Logo uploaded successfully!</p>
        </div>
      )}

      {loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          <p className="text-sm">Uploading...</p>
        </div>
      )}
    </div>
  )
}
