'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, AlertCircle, ShieldCheck } from 'lucide-react'
import { verifyAdminPassword } from '@/app/actions/auth'

const SESSION_KEY = 'print_admin_verified'
const SESSION_DURATION_MS = 10 * 60 * 1000 // 10 minutes

interface AdminPasswordGateProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
  actionLabel?: string
  schoolId?: string
}

export function AdminPasswordGate({ isOpen, onClose, onVerified, actionLabel = 'Print Report', schoolId }: AdminPasswordGateProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Please enter the admin password')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await verifyAdminPassword(password, schoolId)
      if (result.success) {
        // Cache verified state in sessionStorage for 10 minutes
        sessionStorage.setItem(SESSION_KEY, String(Date.now()))
        onVerified()
        onClose()
      } else {
        setError('Incorrect admin password. Only administrators can print report forms.')
      }
    } catch {
      setError('Failed to verify password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-foreground">Admin Verification Required</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm mt-0.5">
                {actionLabel} is a restricted action
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="admin-print-password" className="text-foreground text-sm">
              Admin Password
            </Label>
            <Input
              id="admin-print-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Enter admin password"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-border text-foreground"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify & Print'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Helper hook - call attemptPrint() to either proceed immediately
 * (within a fresh 10-min session) or open the password gate first.
 */
export function useAdminPrintGate() {
  const [gateOpen, setGateOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<((() => void) | (() => Promise<void>)) | null>(null)
  const [actionLabel, setActionLabel] = useState('Print Report')

  const isSessionValid = () => {
    const ts = sessionStorage.getItem(SESSION_KEY)
    if (!ts) return false
    return Date.now() - Number(ts) < SESSION_DURATION_MS
  }

  const attemptPrint = (action: (() => void) | (() => Promise<void>), label = 'Print Report') => {
    if (isSessionValid()) {
      // Already verified recently - proceed immediately
      action()
    } else {
      setActionLabel(label)
      setPendingAction(() => action)
      setGateOpen(true)
    }
  }

  const handleVerified = async () => {
    const result = pendingAction?.()
    // Handle both sync and async actions
    if (result instanceof Promise) {
      await result
    }
    setPendingAction(null)
  }

  const handleClose = () => {
    setGateOpen(false)
    setPendingAction(null)
  }

  return { gateOpen, actionLabel, handleVerified, handleClose, attemptPrint }
}
