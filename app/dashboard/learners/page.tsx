'use client'

import React from "react"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClass } from '@/lib/class-context'
import { useSchool } from '@/lib/school-context'
import { Plus, Trash2, Edit2, X, Save, ArrowUpCircle, CheckSquare, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Class {
  id: string
  name: string
  code: string
  display_order: number
  school_id: string
}

interface Learner {
  id: string
  class_id: string
  name: string
  admission_number: string | null
  gender: string | null
  parent_phone: string | null
  birth_cert_number: string | null
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
  const [birthCertNumber, setBirthCertNumber] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAssessmentNumber, setEditAssessmentNumber] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editParentPhone, setEditParentPhone] = useState('')
  const [editBirthCertNumber, setEditBirthCertNumber] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Promotion state
  const [showPromotionMode, setShowPromotionMode] = useState(false)
  const [selectedLearners, setSelectedLearners] = useState<string[]>([])
  const [allClasses, setAllClasses] = useState<Class[]>([])
  const [targetClassId, setTargetClassId] = useState('')
  const [isPromoting, setIsPromoting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
    fetchAllClasses()
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

  async function fetchAllClasses() {
    if (!currentSchool?.id) return
    
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('display_order', { ascending: true })
      
      if (error) throw error
      if (data) setAllClasses(data)
    } catch (error) {
      console.error('Error fetching classes:', error)
    }
  }

  async function handlePromoteStudents() {
    if (selectedLearners.length === 0 || !targetClassId) {
      alert('Please select students and a target class')
      return
    }

    const targetClass = allClasses.find(c => c.id === targetClassId)
    if (!targetClass) return

    const confirmed = confirm(
      `Are you sure you want to promote ${selectedLearners.length} student(s) to ${targetClass.name}?\n\n` +
      `Note: Their previous exam results will be preserved and accessible through historical sessions.`
    )
    if (!confirmed) return

    setIsPromoting(true)
    try {
      const { error } = await supabase
        .from('learners')
        .update({ class_id: targetClassId })
        .in('id', selectedLearners)

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        school_id: currentSchool?.id,
        action: 'promote_students',
        details: `Promoted ${selectedLearners.length} students from ${currentClass?.name} to ${targetClass.name}`,
        performed_by: currentClass?.name || 'Teacher'
      })

      // Remove promoted students from current list
      setLearners(learners.filter(l => !selectedLearners.includes(l.id)))
      setSelectedLearners([])
      setTargetClassId('')
      setShowPromotionMode(false)
      alert(`Successfully promoted ${selectedLearners.length} student(s) to ${targetClass.name}`)
    } catch (error) {
      console.error('Error promoting students:', error)
      alert('Failed to promote students. Please try again.')
    } finally {
      setIsPromoting(false)
    }
  }

  function toggleSelectLearner(learnerId: string) {
    setSelectedLearners(prev => 
      prev.includes(learnerId) 
        ? prev.filter(id => id !== learnerId)
        : [...prev, learnerId]
    )
  }

  function toggleSelectAll() {
    if (selectedLearners.length === learners.length) {
      setSelectedLearners([])
    } else {
      setSelectedLearners(learners.map(l => l.id))
    }
  }

  async function handleAddLearner(e: React.FormEvent) {
    e.preventDefault()
    
    if (!name.trim() || !currentClass) {
      alert("Please enter a learner name and select a class")
      return
    }

    setIsSubmitting(true)
    try {
      const learnerData = {
        name: name.trim(),
        admission_number: assessmentNumber.trim() || null,
        gender: selectedGender || null,
        parent_phone: parentPhone.trim() || null,
        birth_cert_number: birthCertNumber.trim() || null,
        class_id: currentClass.id,
        school_id: currentSchool?.id,
      }
      
      const { data, error } = await supabase.from('learners').insert([learnerData]).select()

      if (error) {
        // Check if it's a missing column error
        if (error.message && error.message.includes('column')) {
          alert(`Database schema issue: ${error.message}\n\nPlease contact support or run the database migration script.`)
        } else if (error.message && error.message.includes('permission')) {
          alert(`Permission error: ${error.message}\n\nPlease ensure you have selected a valid school and class.`)
        } else {
          alert(`Error adding learner: ${error.message}`)
        }
        throw error
      }
      
      if (data) {
        setLearners([...learners, data[0]])
        setName('')
        setAssessmentNumber('')
        setSelectedGender('')
        setParentPhone('')
        setBirthCertNumber('')
        alert('Learner added successfully!')
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
    setEditBirthCertNumber(learner.birth_cert_number || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditAssessmentNumber('')
    setEditGender('')
    setEditParentPhone('')
    setEditBirthCertNumber('')
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
          birth_cert_number: editBirthCertNumber.trim() || null,
        })
        .eq('id', learnerId)

      if (error) throw error

      setLearners(learners.map(l => 
        l.id === learnerId 
          ? { ...l, name: editName.trim(), admission_number: editAssessmentNumber.trim() || null, gender: editGender || null, parent_phone: editParentPhone.trim() || null, birth_cert_number: editBirthCertNumber.trim() || null }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Learners</h1>
          <p className="text-gray-600 mt-1">Add, edit, and manage learners for {currentClass?.name}</p>
        </div>
        <Button
          onClick={() => {
            setShowPromotionMode(!showPromotionMode)
            setSelectedLearners([])
            setTargetClassId('')
          }}
          variant={showPromotionMode ? "destructive" : "outline"}
          className="flex items-center gap-2"
        >
          {showPromotionMode ? (
            <>
              <X className="w-4 h-4" />
              Cancel Promotion
            </>
          ) : (
            <>
              <ArrowUpCircle className="w-4 h-4" />
              Promote Students
            </>
          )}
        </Button>
      </div>

      {/* Promotion Panel */}
      {showPromotionMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5" />
            Promote Students to Next Class
          </h3>
          <p className="text-sm text-amber-700 mb-4">
            Select students below and choose the target class. Historical exam data will be preserved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="flex-1 px-3 py-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select target class...</option>
              {allClasses
                .filter(c => c.id !== currentClass?.id)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              }
            </select>
            <Button
              onClick={handlePromoteStudents}
              disabled={selectedLearners.length === 0 || !targetClassId || isPromoting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isPromoting ? 'Promoting...' : `Promote ${selectedLearners.length} Selected`}
            </Button>
          </div>
          {selectedLearners.length > 0 && (
            <p className="text-sm text-amber-600 mt-2">
              {selectedLearners.length} student(s) selected for promotion
            </p>
          )}
        </div>
      )}

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

            {/* Birth Certificate Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Birth Certificate Number (Optional)</label>
              <input
                type="text"
                value={birthCertNumber}
                onChange={(e) => setBirthCertNumber(e.target.value)}
                placeholder="e.g. 123456789"
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
                  {showPromotionMode && (
                    <th className="px-4 py-4 text-center">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-gray-200 rounded"
                        title={selectedLearners.length === learners.length ? "Deselect all" : "Select all"}
                      >
                        {selectedLearners.length === learners.length ? (
                          <CheckSquare className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">#</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Assessment No.</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Gender</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Parent Phone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Birth Cert #</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((learner, index) => (
                  <tr key={learner.id} className={`border-b border-gray-200 hover:bg-gray-50 ${selectedLearners.includes(learner.id) ? 'bg-amber-50' : ''}`}>
                    {showPromotionMode && (
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => toggleSelectLearner(learner.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {selectedLearners.includes(learner.id) ? (
                            <CheckSquare className="w-5 h-5 text-amber-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </td>
                    )}
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
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editBirthCertNumber}
                            onChange={(e) => setEditBirthCertNumber(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="123456789"
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
                        <td className="px-6 py-4 text-sm text-gray-600">{learner.birth_cert_number || '-'}</td>
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
