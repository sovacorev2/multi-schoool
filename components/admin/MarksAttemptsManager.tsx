import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Lock, Unlock, AlertCircle } from 'lucide-react'

interface MarksAttempt {
  id: string
  session_id: string
  school_id: string
  attempts_remaining: number
  is_locked: boolean
  locked_at: string | null
  locked_by: string | null
  created_at: string
}

interface Session {
  id: string
  class_id: string
  exam_type_id: string
  term: number
  year: number
  exam_types?: { name: string } | null
  class?: { name: string } | null
}

interface MarksAttemptsManagerProps {
  school: any
}

export function MarksAttemptsManager({ school }: MarksAttemptsManagerProps) {
  const [attempts, setAttempts] = useState<(MarksAttempt & { session?: Session })[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Fetch all sessions for this school (via all classes in the school)
        const { data: classesData } = await supabase
          .from('classes')
          .select('id')
          .eq('school_id', school.id)

        if (!classesData || classesData.length === 0) {
          setSessions([])
          setAttempts([])
          setIsLoading(false)
          return
        }

        const classIds = classesData.map(c => c.id)

        // Fetch sessions for these classes with exam details
        const { data: sessionsData } = await supabase
          .from('sessions')
          .select('*, exam_types(*), classes(*)')
          .in('class_id', classIds)
          .order('year', { ascending: false })
          .order('term', { ascending: false })

        setSessions(sessionsData || [])

        // Fetch attempts records for this school
        const { data: attemptsData } = await supabase
          .from('marks_entry_attempts')
          .select('*')
          .eq('school_id', school.id)
          .order('created_at', { ascending: false })

        // Merge attempts with session details
        const attemptsWithSessions = (attemptsData || []).map(attempt => {
          const session = sessionsData?.find(s => s.id === attempt.session_id)
          return { ...attempt, session }
        })

        setAttempts(attemptsWithSessions)
      } catch (error) {
        console.error('Error loading marks attempts data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (school?.id) {
      loadData()
    }
  }, [school?.id])

  const handleUnlockAndReset = async (attemptId: string, sessionId: string) => {
    setActionInProgress(attemptId)
    try {
      const { error } = await supabase
        .from('marks_entry_attempts')
        .update({
          attempts_remaining: 3,
          is_locked: false,
          locked_at: null,
          locked_by: null,
          unlocked_at: new Date().toISOString(),
          unlocked_by: 'Admin'
        })
        .eq('id', attemptId)

      if (!error) {
        // Update local state
        setAttempts(attempts.map(a =>
          a.id === attemptId
            ? { ...a, attempts_remaining: 3, is_locked: false, locked_at: null, locked_by: null }
            : a
        ))
      }
    } catch (error) {
      console.error('Error unlocking attempts:', error)
      alert('Failed to unlock attempts. Please try again.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleLock = async (attemptId: string) => {
    setActionInProgress(attemptId)
    try {
      const { error } = await supabase
        .from('marks_entry_attempts')
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: 'Admin'
        })
        .eq('id', attemptId)

      if (!error) {
        setAttempts(attempts.map(a =>
          a.id === attemptId
            ? { ...a, is_locked: true, locked_at: new Date().toISOString(), locked_by: 'Admin' }
            : a
        ))
      }
    } catch (error) {
      console.error('Error locking attempts:', error)
      alert('Failed to lock attempts. Please try again.')
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (attempts.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Entry Records</AlertTitle>
        <AlertDescription>
          No marks entry attempt records found yet. They will appear here once teachers start entering marks.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900">Amagoro School - Marks Entry Attempts</AlertTitle>
        <AlertDescription className="text-blue-800">
          Teachers at Amagoro School have a maximum of 3 attempts to enter marks for each exam session. After the 3rd save, the entry will automatically lock unless unlocked by an admin.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Exam Type</TableHead>
              <TableHead>Attempts Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((attempt) => (
              <TableRow key={attempt.id}>
                <TableCell className="font-medium">
                  {attempt.session?.class_id ? `Class ${attempt.session.class_id}` : 'Unknown Class'}
                </TableCell>
                <TableCell>
                  {attempt.session?.exam_types?.name || 'Unknown Exam'}
                </TableCell>
                <TableCell>
                  <Badge variant={attempt.attempts_remaining === 0 ? 'destructive' : 'default'}>
                    {attempt.attempts_remaining} / 3
                  </Badge>
                </TableCell>
                <TableCell>
                  {attempt.is_locked ? (
                    <Badge variant="destructive" className="gap-1">
                      <Lock className="w-3 h-3" />
                      Locked
                    </Badge>
                  ) : attempt.attempts_remaining === 0 ? (
                    <Badge variant="secondary" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Exhausted
                    </Badge>
                  ) : attempt.attempts_remaining === 1 ? (
                    <Badge variant="outline" className="gap-1 bg-yellow-50 border-yellow-300 text-yellow-800">
                      <AlertCircle className="w-3 h-3" />
                      Warning
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Unlock className="w-3 h-3" />
                      Open
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {attempt.is_locked ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnlockAndReset(attempt.id, attempt.session_id)}
                        disabled={actionInProgress === attempt.id}
                        className="gap-1"
                      >
                        <Unlock className="w-3 h-3" />
                        Unlock & Reset
                      </Button>
                    ) : (
                      <>
                        {attempt.attempts_remaining > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLock(attempt.id)}
                            disabled={actionInProgress === attempt.id}
                            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Lock className="w-3 h-3" />
                            Lock
                          </Button>
                        )}
                        {attempt.attempts_remaining === 0 && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleUnlockAndReset(attempt.id, attempt.session_id)}
                            disabled={actionInProgress === attempt.id}
                            className="gap-1"
                          >
                            <Unlock className="w-3 h-3" />
                            Reset
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
