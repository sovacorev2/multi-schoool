'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface School {
  id: string
  name: string
  short_name: string | null
  code: string
  tagline: string | null
  email: string | null
  phone: string | null
  address: string | null
  logo_url: string | null
  primary_color: string
  is_active: boolean
  feature_report_cards?: boolean
  feature_whatsapp_reports?: boolean
  feature_certificates?: boolean
  feature_bulk_sms?: boolean
  subscription_plan?: string
  subscription_expires_at?: string | null
}

interface SchoolContextType {
  currentSchool: School | null
  setCurrentSchool: (school: School | null) => void
  clearSchool: () => void
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined)

const SCHOOL_STORAGE_KEY = 'exam-system-school'

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [currentSchool, setCurrentSchoolState] = useState<School | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load school from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SCHOOL_STORAGE_KEY)
    if (stored) {
      try {
        setCurrentSchoolState(JSON.parse(stored))
      } catch (e) {
        localStorage.removeItem(SCHOOL_STORAGE_KEY)
      }
    }
    setIsLoaded(true)
  }, [])

  const setCurrentSchool = (school: School | null) => {
    setCurrentSchoolState(school)
    if (school) {
      localStorage.setItem(SCHOOL_STORAGE_KEY, JSON.stringify(school))
    } else {
      localStorage.removeItem(SCHOOL_STORAGE_KEY)
    }
  }

  const clearSchool = () => {
    setCurrentSchoolState(null)
    localStorage.removeItem(SCHOOL_STORAGE_KEY)
  }

  // Don't render children until we've checked localStorage
  if (!isLoaded) {
    return null
  }

  return (
    <SchoolContext.Provider value={{ currentSchool, setCurrentSchool, clearSchool }}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  const context = useContext(SchoolContext)
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider')
  }
  return context
}
