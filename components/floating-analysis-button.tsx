'use client'

import { BarChart3 } from 'lucide-react'

interface FloatingAnalysisButtonProps {
  onAnalysisClick: () => void
}

export function FloatingAnalysisButton({ onAnalysisClick }: FloatingAnalysisButtonProps) {
  return (
    <>
      {/* Floating Analysis Button - Always visible when on marklist/marks pages */}
      <button
        onClick={onAnalysisClick}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        title="Open Analysis Tab"
        aria-label="Open Analysis"
      >
        <BarChart3 className="w-6 h-6" />
      </button>

      {/* Optional: Tooltip on hover */}
      <div className="fixed bottom-24 right-6 z-40 bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap pointer-events-none opacity-0 transition-opacity">
        Quick Analysis
      </div>
    </>
  )
}
