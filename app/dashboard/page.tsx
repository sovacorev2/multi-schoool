'use client'
export const dynamic = 'force-dynamic'

import { useClass } from '@/lib/class-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, BookOpen, ClipboardList, FileText } from 'lucide-react'
import { useEffect } from 'react'

export default function DashboardPage() {
  const { currentClass } = useClass()
  const router = useRouter()

  useEffect(() => {
    if (!currentClass) {
      router.push('/')
    }
  }, [currentClass, router])

  if (!currentClass) return null

  return (
    <div className="space-y-8">
      {/* Marks Management Workflow Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Marks Management Workflow</h2>
        <p className="text-gray-600 text-lg">Follow these steps to complete your marks entry process</p>
      </div>

      {/* Workflow Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Step 1 - Register Learners */}
        <Link href="/dashboard/learners">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-8 rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-md h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold bg-white bg-opacity-20 px-3 py-1 rounded-full">Step 1</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Register Learners</h3>
            <p className="text-sm text-blue-100">Add and manage student information</p>
          </div>
        </Link>

        {/* Step 2 - Configure Subjects */}
        <Link href="/dashboard/subjects">
          <div className="bg-white text-gray-900 p-8 rounded-lg cursor-pointer hover:shadow-lg transition-all border border-gray-200 h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-gray-600" />
              </div>
              <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">Step 2</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Configure Subjects</h3>
            <p className="text-sm text-gray-600">Set up subjects for your class</p>
          </div>
        </Link>

        {/* Step 3 - Enter Marks */}
        <Link href="/dashboard/marks">
          <div className="bg-white text-gray-900 p-8 rounded-lg cursor-pointer hover:shadow-lg transition-all border border-gray-200 h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-gray-600" />
              </div>
              <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">Step 3</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Enter Marks</h3>
            <p className="text-sm text-gray-600">Record exam results and scores</p>
          </div>
        </Link>

        {/* Step 4 - Generate Marklist */}
        <Link href="/dashboard/marklist">
          <div className="bg-white text-gray-900 p-8 rounded-lg cursor-pointer hover:shadow-lg transition-all border border-gray-200 h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-600" />
              </div>
              <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">Step 4</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Generate Marklist</h3>
            <p className="text-sm text-gray-600">Create and export reports</p>
          </div>
        </Link>

        {/* Step 5 - Analysis */}
        <Link href="/dashboard/marklist?tab=analysis">
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white p-8 rounded-lg cursor-pointer hover:from-purple-700 hover:to-purple-800 transition-all shadow-md h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold bg-white bg-opacity-20 px-3 py-1 rounded-full">Step 5</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Analysis</h3>
            <p className="text-sm text-purple-100">View performance analytics</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
