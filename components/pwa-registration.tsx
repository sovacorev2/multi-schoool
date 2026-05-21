'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWARegistration() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [schoolName, setSchoolName] = useState('Shuletech')
  const [schoolId, setSchoolId] = useState<string | null>(null)

  useEffect(() => {
    // Get school info from localStorage
    const teacherSession = localStorage.getItem('teacher_session')
    const schoolFromSession = localStorage.getItem('current_school_id')
    const schoolNameFromSession = localStorage.getItem('current_school_name')

    if (teacherSession) {
      try {
        const session = JSON.parse(teacherSession)
        setSchoolId(session.schoolId)
      } catch (e) {
        console.log('[v0] Could not parse teacher session')
      }
    }

    if (schoolFromSession) {
      setSchoolId(schoolFromSession)
    }

    if (schoolNameFromSession) {
      setSchoolName(schoolNameFromSession)
    }

    // Update manifest dynamically
    updateManifest(schoolId || schoolFromSession, schoolNameFromSession)

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[v0] SW registered:', registration.scope)
        })
        .catch((error) => {
          console.log('[v0] SW registration failed:', error)
        })
    } else {
      console.log('[v0] Service worker not supported')
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[v0] App already installed (standalone mode)')
      setIsInstalled(true)
      return
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[v0] beforeinstallprompt fired!')
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Check if user dismissed the banner before
      const dismissed = localStorage.getItem(`pwa-install-dismissed-${schoolId}`)
      if (!dismissed) {
        setShowInstallBanner(true)
      }
    }

    console.log('[v0] Adding beforeinstallprompt listener')
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowInstallBanner(false)
      setDeferredPrompt(null)
      // Mark as installed for this school
      localStorage.setItem(`pwa-installed-${schoolId}`, 'true')
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const updateManifest = async (id: string | null, name: string | null) => {
    try {
      if (!id && !name) return

      // Fetch dynamic manifest
      const params = new URLSearchParams()
      if (id) params.append('schoolId', id)
      if (name) params.append('schoolName', name)

      const manifestUrl = `/api/manifest?${params.toString()}`

      // Create or update manifest link in head
      let link = document.querySelector('link[rel="manifest"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'manifest'
        document.head.appendChild(link)
      }
      link.href = manifestUrl

      console.log('[v0] Manifest updated:', manifestUrl)
    } catch (error) {
      console.log('[v0] Error updating manifest:', error)
    }
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowInstallBanner(false)
      console.log(`[v0] User installed ${schoolName} app`)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    localStorage.setItem(`pwa-install-dismissed-${schoolId}`, 'true')
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
        <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-teal-600" />
        </div>
        <div className="flex-1 pr-4">
          <h3 className="font-semibold text-gray-900">Install {schoolName}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Install for quick access from your desktop or home screen
          </p>
          <Button onClick={handleInstall} size="sm" className="mt-3 bg-teal-600 hover:bg-teal-700">
            Install App
          </Button>
        </div>
      </div>
    </div>
  )
}
