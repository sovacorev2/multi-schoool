'use client'

import React from "react"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
import { Plus, Trash2, Edit2, X, Save } from 'lucide-react'

interface Learner {
  id: string
  class_id: string
  name: string
  admission_number: string | null
  gender: string | null
  parent_phone: string | null
  created_at: string
}

export default function LearnersPage() {
  const { currentClass } = useClass()
  const { currentSchool } = useSchool()
  const [learners, setLearners] = useState<Learner[]>([])
  const [name, setName] = useState('')
  const [assessmentNumber, setAssessmentNumber] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAssessmentNumber, setEditAssessmentNumber] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editParentPhone, setEditParentPhone] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

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
          admission_number: assessmentNumber.trim() || null,
          gender: selectedGender || null,
          parent_phone: parentPhone.trim() || null,
          class_id: currentClass.id,
          school_id: currentSchool?.id,
        },
      ]).select()

      if (error) throw error
      if (data) {
        setLearners([...learners, data[0]])
        setName('')
        setAssessmentNumber('')
        setSelectedGender('')
        setParentPhone('')
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

  function startEdit(learner: Learner) {
    setEditingId(learner.id)
    setEditName(learner.name)
    setEditAssessmentNumber(learner.admission_number || '')
    setEditGender(learner.gender || '')
    setEditParentPhone(learner.parent_phone || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditAssessmentNumber('')
    setEditGender('')
    setEditParentPhone('')
  }

  async function handleUpdateLearner(learnerId: string) {
    if (!editName.trim()) return

    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('learners')
        .update({
          name: editName.trim(),
          admission_number: editAssessmentNumber.trim() || null,
          gender: editGender || null,
          parent_phone: editParentPhone.trim() || null,
        })
        .eq('id', learnerId)

      if (error) throw error

      setLearners(learners.map(l => 
        l.id === learnerId 
          ? { ...l, name: editName.trim(), admission_number: editAssessmentNumber.trim() || null, gender: editGender || null, parent_phone: editParentPhone.trim() || null }
          : l
      ))
      cancelEdit()
    } catch (error) {
      console.error('Error updating learner:', error)
    } finally {
      setIsUpdating(false)
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

            {/* Assessment Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Number (Optional)</label>
              <input
                type="text"
                value={assessmentNumber}
                onChange={(e) => setAssessmentNumber(e.target.value)}
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

            {/* Parent Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Phone (Optional)</label>
              <input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="e.g. 0712345678"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
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
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">#</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Assessment No.</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Gender</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Parent Phone</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((learner, index) => (
                  <tr key={learner.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                    {editingId === learner.id ? (
                      <>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editAssessmentNumber}
                            onChange={(e) => setEditAssessmentNumber(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Assessment No."
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Name"
                            required
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={editGender}
                            onChange={(e) => setEditGender(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="tel"
                            value={editParentPhone}
                            onChange={(e) => setEditParentPhone(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="0712345678"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => handleUpdateLearner(learner.id)}
                              disabled={isUpdating || !editName.trim()}
                              className="inline-flex p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              <Save className="w-5 h-5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="inline-flex p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-600">{learner.admission_number || '-'}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{learner.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{learner.gender || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{learner.parent_phone || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => startEdit(learner)}
                              className="inline-flex p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit learner"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLearner(learner.id)}
                              className="inline-flex p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete learner"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
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
