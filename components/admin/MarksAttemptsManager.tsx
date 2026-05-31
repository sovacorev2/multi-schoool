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
  const [attempts, setAttempts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSettingUp, setIsSettingUp] = useState(false)

  const supabase = createClient()

  const setupTable = async () => {
    setIsSettingUp(true)
    try {
      console.log('[v0] Setting up marks_entry_attempts table...')
      
      // Call the setup API endpoint
      const response = await fetch('/api/admin/setup-marks-attempts', {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        console.log('[v0] Table setup successful, waiting for schema cache refresh...')
        setError(null)
        
        // Wait a moment for the schema cache to refresh in Supabase
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Retry loading data with additional retries
        let retries = 0
        let dataLoaded = false
        
        while (retries < 3 && !dataLoaded) {
          try {
            const { data, error } = await supabase
              .from('marks_entry_attempts')
              .select('id')
              .limit(1)
            
            if (!error) {
              console.log('[v0] Table is now accessible')
              dataLoaded = true
              // Reload all data
              await loadData()
            } else if (retries < 2) {
              console.log(`[v0] Retry ${retries + 1}/3 for table access...`)
              await new Promise(resolve => setTimeout(resolve, 1500))
            }
          } catch (err) {
            console.error('[v0] Retry error:', err)
          }
          retries++
        }
        
        if (!dataLoaded) {
          setError('Table created but still initializing. Please refresh the page in a few seconds.')
        }
      } else {
        setError(result.message || 'Failed to create table')
      }
    } catch (err) {
      console.error('[v0] Setup error:', err)
      setError('Setup failed. Please try again.')
    } finally {
      setIsSettingUp(false)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      console.log('[v0] Loading marks attempts for school:', school.id)
      
      // Fetch attempts records for this school with full session and exam details
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('marks_entry_attempts')
        .select(`
          *,
          sessions (
            id,
            class_id,
            exam_type_id,
            term,
            year,
            exam_types (name),
            classes (name)
          )
        `)
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })

      console.log('[v0] Fetch result - Error:', attemptsError)
      console.log('[v0] Data received:', attemptsData)

      if (attemptsError) {
        console.error('[v0] Error fetching attempts:', attemptsError.message, attemptsError.code)
        
        // Check if it's a "relation does not exist" or "table not found" error
        // PGRST116 = relation does not exist
        // PGRST09 = table not found in schema cache
        if (attemptsError.code === 'PGRST116' || attemptsError.code === 'PGRST09' || attemptsError.message?.includes('does not exist') || attemptsError.message?.includes('Could not find')) {
          setError('marks_entry_attempts table not found. Please initialize it first.')
        } else {
          setError(attemptsError.message || 'Failed to load attempts')
        }
        setAttempts([])
      } else {
        console.log('[v0] Successfully fetched attempts:', attemptsData?.length || 0, 'records')
        setAttempts(attemptsData || [])
        setError(null)
      }
    } catch (error) {
      console.error('[v0] Error loading marks attempts data:', error)
      setError(String(error))
      setAttempts([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
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

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Setup Required</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">{error}</p>
          <div className="flex flex-col gap-2">
            <Button 
              onClick={setupTable} 
              disabled={isSettingUp}
              className="w-fit"
            >
              {isSettingUp ? 'Setting up... (please wait)' : 'Initialize Marks Attempts Table'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Clicking the button will create the required database table and polling for confirmation. This may take 10-15 seconds.
            </p>
          </div>
        </AlertDescription>
      </Alert>
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
            {attempts.map((attempt: any) => (
              <TableRow key={attempt.id}>
                <TableCell className="font-medium">
                  {attempt.sessions?.classes?.name || 'Unknown Class'}
                </TableCell>
                <TableCell>
                  {attempt.sessions?.exam_types?.name || 'Unknown Exam'}
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
