'use client'

import React, { createContext, useContext, useState } from 'react'
import type { School } from './types'

interface AdminSchoolContextValue {
  school: School | null
  setSchool: (school: School | null) => void
}

const AdminSchoolContext = createContext<AdminSchoolContextValue | null>(null)

export function AdminSchoolProvider({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<School | null>(null)
  return (
    <AdminSchoolContext.Provider value={{ school, setSchool }}>
      {children}
    </AdminSchoolContext.Provider>
  )
}

// Every admin-portal section page reads the authenticated school record from
// here instead of re-fetching it, so edits made in Settings are immediately
// visible everywhere else (header, feature-gated nav items, etc.).
export function useAdminSchool(): AdminSchoolContextValue {
  const ctx = useContext(AdminSchoolContext)
  if (!ctx) throw new Error('useAdminSchool must be used within AdminSchoolProvider (i.e. under app/admin-portal/layout.tsx)')
  return ctx
}
