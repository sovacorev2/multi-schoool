'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  feature_bulk_sms?: boolean
  feature_sms?: boolean
  twilio_phone_number?: string | null
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

  // Real-time subscription to update school features when super admin changes them
  useEffect(() => {
    if (!currentSchool?.id) return

    const supabase = createClient()
    const channel = supabase
      .channel(`school-${currentSchool.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'schools',
          filter: `id=eq.${currentSchool.id}`
        },
        (payload) => {
          const updatedSchool = { ...currentSchool, ...payload.new } as School
          setCurrentSchoolState(updatedSchool)
          localStorage.setItem(SCHOOL_STORAGE_KEY, JSON.stringify(updatedSchool))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentSchool?.id])

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
