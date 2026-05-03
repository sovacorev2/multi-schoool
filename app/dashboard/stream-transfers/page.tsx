'use client'

import { useEffect, useState } from 'react'
import { useSchool } from '@/lib/school-context'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface StreamClass {
  id: string
  name: string
}

interface Learner {
  id: string
  name: string
  class_id: string
  current_class: string
}

export default function StreamTransfersPage() {
  const { currentSchool } = useSchool()
  const [classes, setClasses] = useState<StreamClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [learners, setLearners] = useState<Learner[]>([])
  const [loading, setLoading] = useState(false)
  const [transferring, setTransferring] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

  // Fetch all classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch('/api/classes')
        const data = await response.json()
        setClasses(data)
      } catch (error) {
        console.error('[v0] Error fetching classes:', error)
      }
    }
    fetchClasses()
  }, [])

  // Fetch learners when class is selected
  useEffect(() => {
    if (!selectedClassId) {
      setLearners([])
      return
    }

    const fetchLearners = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/learners?class_id=${selectedClassId}`)
        const data = await response.json()
        setLearners(data)
      } catch (error) {
        console.error('[v0] Error fetching learners:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLearners()
  }, [selectedClassId])

  const handleTransfer = async (learnerId: string, newClassId: string) => {
    if (!selectedClassId || !newClassId || newClassId === selectedClassId) return

    setTransferring(learnerId)
    try {
      const response = await fetch('/api/learners/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          newClassId,
          fromStream: selectedClassId,
          toStream: newClassId
        })
      })

      if (response.ok) {
        setSuccessMessage('Learner transferred successfully')
        // Refresh learners list
        const refreshResponse = await fetch(`/api/learners?class_id=${selectedClassId}`)
        const data = await refreshResponse.json()
        setLearners(data)
        
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        alert('Failed to transfer learner')
      }
    } catch (error) {
      console.error('[v0] Transfer error:', error)
      alert('Error transferring learner')
    } finally {
      setTransferring(null)
    }
  }

  // Get other stream options for current grade
  const getCurrentGradeStreams = () => {
    if (!selectedClassId) return []
    const selectedClass = classes.find(c => c.id === selectedClassId)
    if (!selectedClass) return []

    const gradeLevel = selectedClass.name.split(' ').slice(0, -1).join(' ')
    return classes.filter(
      c => c.name.startsWith(gradeLevel) && 
      c.id !== selectedClassId &&
      c.name.trim().split(/\s+/).length > 2
    )
  }

  if (!currentSchool) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Stream Transfers</h1>
          <p className="text-gray-600">Move learners between streams within the same grade level</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {successMessage}
          </div>
        )}

        {/* Class Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Class</CardTitle>
            <CardDescription>Choose a class to see its learners</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a class..." />
              </SelectTrigger>
              <SelectContent>
                {classes.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Learners List */}
        {selectedClassId && (
          <Card>
            <CardHeader>
              <CardTitle>Learners in {classes.find(c => c.id === selectedClassId)?.name}</CardTitle>
              <CardDescription>{learners.length} learner(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading learners...</div>
              ) : learners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No learners in this class</div>
              ) : (
                <div className="space-y-4">
                  {learners.map(learner => (
                    <div key={learner.id} className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-900">{learner.name}</p>
                        <p className="text-sm text-gray-500">Current: {classes.find(c => c.id === learner.class_id)?.name}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getCurrentGradeStreams().length > 0 ? (
                          <>
                            <Select
                              value=""
                              onValueChange={(newClassId) => handleTransfer(learner.id, newClassId)}
                              disabled={transferring === learner.id}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Move to..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getCurrentGradeStreams().map(stream => (
                                  <SelectItem key={stream.id} value={stream.id}>
                                    {stream.name.split(' ').slice(2).join(' ')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {transferring === learner.id && (
                              <span className="text-sm text-gray-500">Transferring...</span>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">No other streams available</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
