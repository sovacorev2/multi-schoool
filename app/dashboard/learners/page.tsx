'use client'

import React from "react"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
import { Plus, Trash2 } from 'lucide-react'

interface Learner {
  id: string
  class_id: string
  name: string
  admission_number: string | null
  gender: string | null
  created_at: string
}

export default function LearnersPage() {
  const { currentClass } = useClass()
  const { currentSchool } = useSchool()
  const [learners, setLearners] = useState<Learner[]>([])
  const [name, setName] = useState('')
  const [admissionNumber, setAdmissionNumber] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [currentClass?.id])

  async function fetchData() {
    if (!currentClass) {
      return
    }

    try {
      const { data: learnersData, error: learnersError } = await supabase
        .from('learners')
        .select('*')
        .eq('class_id', currentClass.id)
        .order('name', { ascending: true })

      if (learnersError) {
        console.error('Error fetching learners:', learnersError)
      }

      if (learnersData) setLearners(learnersData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddLearner(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !currentClass) return

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.from('learners').insert([
        {
          name: name.trim(),
          admission_number: admissionNumber.trim() || null,
          gender: selectedGender || null,
          class_id: currentClass.id,
          school_id: currentSchool?.id,
        },
      ]).select()

      if (error) throw error
      if (data) {
        setLearners([...learners, data[0]])
        setName('')
        setAdmissionNumber('')
        setSelectedGender('')
      }
    } catch (error) {
      console.error('Error adding learner:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteLearner(learnerId: string) {
    if (!confirm('Are you sure you want to delete this learner?')) return

    try {
      const { error } = await supabase.from('learners').delete().eq('id', learnerId)
      if (error) throw error
      setLearners(learners.filter((l) => l.id !== learnerId))
    } catch (error) {
      console.error('Error deleting learner:', error)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Learners</h1>
        <p className="text-gray-600 mt-2">Add, edit, and manage learners for {currentClass?.name}</p>
      </div>

      {/* Add Learner Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Register New Learner</h2>
        
        <form onSubmit={handleAddLearner} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Admission Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admission Number (Optional)</label>
              <input
                type="text"
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Add Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
              >
                <Plus className="w-5 h-5 inline-block mr-2" />
                Add Learner
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Learners Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Registered Learners ({learners.length})
          </h2>
        </div>

        {learners.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No learners registered yet. Add your first learner above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">#</th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">Admission No.</th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">Student Name</th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">Gender</th>
                  <th className="px-8 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((learner, index) => (
                  <tr key={learner.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-8 py-4 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-8 py-4 text-sm text-gray-600">{learner.admission_number || '-'}</td>
                    <td className="px-8 py-4 text-sm font-medium text-gray-900">{learner.name}</td>
                    <td className="px-8 py-4 text-sm text-gray-600">{learner.gender || '-'}</td>
                    <td className="px-8 py-4 text-center">
                      <button
                        onClick={() => handleDeleteLearner(learner.id)}
                        className="inline-flex p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
