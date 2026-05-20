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

interface RecentPromotion {
  learner_id: string
  promoted_at: string
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
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  
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
  const [promotedLearnersInTarget, setPromotedLearnersInTarget] = useState<Set<string>>(new Set())
  const [previouslyPromotedLearners, setPreviouslyPromotedLearners] = useState<Set<string>>(new Set())
  const [recentPromotions, setRecentPromotions] = useState<Map<string, string>>(new Map())

  const supabase = createClient()

  useEffect(() => {
    fetchData()
    fetchAllClasses()
  }, [currentClass?.id])

  // Check for duplicates in real-time as user types
  useEffect(() => {
    if (!name.trim()) {
      setDuplicateWarning(null)
      return
    }

    // Check local learners list for duplicates
    const duplicates = learners.filter(l =>
      l.name.toLowerCase() === name.trim().toLowerCase() ||
      (assessmentNumber.trim() && l.admission_number === assessmentNumber.trim())
    )

    if (duplicates.length > 0) {
      const duplicateInfo = duplicates
        .map(d => `${d.name}${d.admission_number ? ` (${d.admission_number})` : ''}`)
        .join(', ')
      setDuplicateWarning(`Existing learner found: ${duplicateInfo}`)
    } else {
      setDuplicateWarning(null)
    }
  }, [name, assessmentNumber, learners])

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

      // Fetch recent promotions (within 15 days) - get from activity logs
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentPromotionLogs } = await supabase
        .from('activity_logs')
        .select('details, created_at')
        .eq('action', 'promote_students')
        .gte('created_at', fifteenDaysAgo)
        .order('created_at', { ascending: false })
      
      if (recentPromotionLogs && recentPromotionLogs.length > 0) {
        const recentPromoMap = new Map<string, string>()
        recentPromotionLogs.forEach(log => {
          // Parse promotion details to extract learner names/count
          // Details format: "Promoted 3 students from Grade 1 to Grade 2"
          const matches = log.details?.match(/Promoted (\d+) students/)
          if (matches && log.created_at) {
            // For now, mark the promotion date so we can show badges
            // We'll need a way to track individual learner promotions
            const promotionDate = log.created_at
            // Store as a marker - we'll update this when we have the actual learner tracking
            recentPromoMap.set(`promotion-${log.created_at}`, promotionDate)
          }
        })
        setRecentPromotions(recentPromoMap)
      }

      // Fetch learners who were promoted from this class to see promotion history
      // These are learners whose class_id is NOT the current class but who previously had this class_id
      // We'll fetch all activity logs for promotions from this class
      const { data: promotionLogs } = await supabase
        .from('activity_logs')
        .select('details')
        .eq('action', 'promote_students')
        .ilike('details', `%from ${currentClass.name}%`)
        .limit(100)
      
      if (promotionLogs && promotionLogs.length > 0) {
        // Extract learner counts from promotion records to show they've been promoted
        setPreviouslyPromotedLearners(new Set())
      }
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

  async function fetchPromotedLearnersInTarget(classId: string) {
    try {
      // Fetch learners already in target class - these are the ones already promoted
      const { data } = await supabase
        .from('learners')
        .select('id')
        .eq('class_id', classId)
      
      if (data) {
        setPromotedLearnersInTarget(new Set(data.map(l => l.id)))
      }
    } catch (error) {
      console.error('Error fetching promoted learners:', error)
    }
  }

  function handleTargetClassChange(classId: string) {
    setTargetClassId(classId)
    fetchPromotedLearnersInTarget(classId)
  }

  function isRecentlyPromoted(learnerId: string): boolean {
    // Check if learner was promoted within the last 15 days
    if (!learnerId) return false
    
    // If the learner has a recent promotion record, return true
    for (const [key, value] of recentPromotions.entries()) {
      if (key.includes(learnerId)) {
        return true
      }
    }
    
    // Alternative: check if created_at or last modification was recent
    // For now, we'll rely on the activity_logs data
    return false
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

      // Log activity with teacher PIN and track recently promoted learners
      const now = new Date().toISOString()
      const teacherPin = typeof window !== 'undefined' ? localStorage.getItem('teacher_pin') : null
      await supabase.from('activity_logs').insert({
        school_id: currentSchool?.id,
        class_id: currentClass?.id,
        teacher_pin: teacherPin,
        action: 'promote_students',
        details: `Promoted ${selectedLearners.length} students from ${currentClass?.name} to ${targetClass.name}. Learners: ${selectedLearners.join(', ')}`,
        performed_by: teacherPin || 'Teacher'
      })

      // Update recent promotions state to show badges for 15 days
      const updatedRecentPromotions = new Map(recentPromotions)
      selectedLearners.forEach(learnerId => {
        updatedRecentPromotions.set(learnerId, now)
      })
      setRecentPromotions(updatedRecentPromotions)

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
      // Check for duplicates - same name + admission number in same class
      const { data: existingLearners, error: checkError } = await supabase
        .from('learners')
        .select('id, name, admission_number')
        .eq('class_id', currentClass.id)
        .or(`name.ilike.${name.trim()},admission_number.eq.${assessmentNumber.trim() || null}`)

      if (checkError) {
        console.error('[v0] Error checking duplicates:', checkError)
      }

      // Check for exact or near-duplicate matches
      if (existingLearners && existingLearners.length > 0) {
        const duplicates = existingLearners.filter(existing => 
          existing.name.toLowerCase() === name.trim().toLowerCase() ||
          (assessmentNumber.trim() && existing.admission_number === assessmentNumber.trim())
        )

        if (duplicates.length > 0) {
          const duplicateInfo = duplicates
            .map(d => `${d.name}${d.admission_number ? ` (${d.admission_number})` : ''}`)
            .join(', ')
          
          const userConfirmed = confirm(
            `⚠️ DUPLICATE LEARNER DETECTED\n\n` +
            `A learner with similar information already exists:\n${duplicateInfo}\n\n` +
            `Are you sure you want to register this learner again?\n` +
            `(This is usually not recommended)`
          )

          if (!userConfirmed) {
            setIsSubmitting(false)
            return
          }
        }
      }

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
        alert('Learner registered successfully!')
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
              onChange={(e) => handleTargetClassChange(e.target.value)}
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
          {targetClassId && promotedLearnersInTarget.size > 0 && (
            <div className="mt-3 p-3 bg-amber-100 border border-amber-300 rounded text-sm text-amber-800">
              <strong>⚠️ Already Promoted:</strong> {promotedLearnersInTarget.size} student(s) are already in the target class and will be skipped.
            </div>
          )}
        </div>
      )}

      {/* Add Learner Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Register New Learner</h2>
        
        {/* Duplicate Warning Alert */}
        {duplicateWarning && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-800">⚠️ Duplicate Learner Detected</h3>
              <p className="text-sm text-amber-700 mt-1">{duplicateWarning}</p>
              <p className="text-xs text-amber-600 mt-2">This learner appears to already be registered in this class. Please verify before registering again.</p>
            </div>
          </div>
        )}
        
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
                {learners.map((learner, index) => {
                  const isAlreadyPromoted = promotedLearnersInTarget.has(learner.id)
                  return (
                  <tr key={learner.id} className={`border-b border-gray-200 hover:bg-gray-50 ${isAlreadyPromoted ? 'bg-red-50' : selectedLearners.includes(learner.id) ? 'bg-amber-50' : ''}`}>
                    {showPromotionMode && (
                      <td className="px-4 py-4 text-center">
                        {isAlreadyPromoted ? (
                          <div title="Already promoted to target class" className="p-1">
                            <span className="text-red-600 font-bold">✓</span>
                          </div>
                        ) : (
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
                        )}
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
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{learner.name}</span>
                            {recentPromotions.has(learner.id) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 animate-pulse" title="Recently promoted within the last 15 days">
                                ✓ Promoted
                              </span>
                            )}
                            {previouslyPromotedLearners.has(learner.id) && !recentPromotions.has(learner.id) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800" title="This learner was promoted in a previous cycle">
                                Previously Promoted
                              </span>
                            )}
                          </div>
                        </td>
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
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
