'use client'
export const dynamic = 'force-dynamic'

import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-gray-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re Offline</h1>
        <p className="text-gray-600 mb-6">
          It seems you&apos;ve lost your internet connection. Please check your connection and try again.
        </p>
        <Button onClick={() => window.location.reload()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}
