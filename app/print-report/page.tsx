'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { ReportStareheStyle } from '@/components/report-starehe-style'

export default function PrintReportPage() {
  const [reportData, setReportData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Retrieve report data from sessionStorage
    const data = sessionStorage.getItem('printReportData')
    if (data) {
      try {
        setReportData(JSON.parse(data))
      } catch (error) {
        console.error('[v0] Error parsing report data:', error)
      }
    }
    setIsLoading(false)
    
    // Auto-print after content loads
    setTimeout(() => {
      window.print()
    }, 1000)
  }, [])

  if (isLoading) {
    return <div className="p-8 text-center">Loading report...</div>
  }

  if (!reportData) {
    return (
      <div className="p-8 text-center">
        <p>No report data found. Please return to the system and try again.</p>
        <button onClick={() => window.close()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
          Close Window
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <ReportStareheStyle
        reportModalData={reportData.results}
        termHistory={reportData.termHistory}
        className={reportData.className}
        examType={reportData.examType}
        subjects={reportData.subjects}
        term={reportData.term}
      />
    </div>
  )
}
