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
    // Get school info for manifest
    const updateManifest = async () => {
      try {
        let manifestUrl = '/api/admin-manifest'
        if (schoolId || schoolName) {
          const params = new URLSearchParams()
          if (schoolId) params.append('schoolId', schoolId)
          if (schoolName) params.append('schoolName', schoolName)
          manifestUrl += `?${params.toString()}`
        }

        // Create or update manifest link in head
        let link = document.querySelector('link[rel="manifest"]')
        if (!link) {
          link = document.createElement('link')
          link.rel = 'manifest'
          document.head.appendChild(link)
        }
        link.href = manifestUrl

        console.log('[v0] Admin manifest updated:', manifestUrl)
      } catch (error) {
        console.log('[v0] Error updating admin manifest:', error)
      }
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[v0] SW registered for admin:', registration.scope)
        })
        .catch((error) => {
          console.log('[v0] SW registration failed for admin:', error)
        })
    }

    updateManifest()

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[v0] Admin app already installed (standalone mode)')
      setIsInstalled(true)
      return
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[v0] beforeinstallprompt fired for admin!')
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Check if user dismissed before
      const dismissed = localStorage.getItem('admin-pwa-install-dismissed')
      if (!dismissed) {
        setShowInstallBanner(true)
      }
    }

    console.log('[v0] Adding beforeinstallprompt listener for admin')
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowInstallBanner(false)
      setDeferredPrompt(null)
      localStorage.setItem('admin-pwa-installed', 'true')
      console.log('[v0] Admin app installed')
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
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
