'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function AdminPWARegistration({ schoolId, schoolName }: { schoolId?: string; schoolName?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Temporarily disabled: Admin PWA manifest API causing 500 errors
    // This will be re-enabled once icon files are properly set up
    console.log('[v0] Admin PWA registration disabled temporarily')
    return
  }, [schoolId, schoolName])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowInstallBanner(false)
      console.log('[v0] Admin app installation accepted')
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    localStorage.setItem('admin-pwa-install-dismissed', 'true')
  }

  if (isInstalled || !showInstallBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-4">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1 pr-4">
          <h3 className="font-semibold text-gray-900">Install Admin Portal</h3>
          <p className="text-sm text-gray-600 mt-1">
            Install for quick access to your admin dashboard from your home screen
          </p>
          <Button onClick={handleInstall} size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">
            Install App
          </Button>
        </div>
      </div>
    </div>
  )
}
