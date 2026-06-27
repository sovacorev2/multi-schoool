'use client'

import { useEffect, useState } from 'react'
import { BarChart3, X } from 'lucide-react'

interface FloatingAnalysisButtonProps {
  onAnalysisClick: () => void
}

export function FloatingAnalysisButton({ onAnalysisClick }: FloatingAnalysisButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Show the button only on the marks tab
    const observer = new MutationObserver(() => {
      const marksTab = document.querySelector('[role="tabpanel"]')
      if (marksTab) {
        setIsVisible(true)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    // Check if marks tab is currently visible
    const marksTab = document.querySelector('[role="tabpanel"]')
    if (marksTab) {
      setIsVisible(true)
    }

    return () => observer.disconnect()
  }, [])

  if (!isVisible) return null

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => {
          setIsExpanded(true)
          onAnalysisClick()
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        title="Open Analysis"
        aria-label="Open Analysis"
      >
        <BarChart3 className="w-6 h-6" />
      </button>

      {/* Tooltip */}
      <div className="fixed bottom-24 right-6 z-40 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
        Quick Analysis
      </div>
    </>
  )
}
