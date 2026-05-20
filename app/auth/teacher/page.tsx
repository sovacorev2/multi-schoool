"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useClass } from "@/lib/class-context"
import { verifyTeacherPassword, setupTeacherPassword } from "@/app/actions/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, Eye, EyeOff, KeyRound } from "lucide-react"

export default function TeacherAuthPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pin, setPin] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsSetup, setNeedsSetup] = useState(false)
  const [showPinScreen, setShowPinScreen] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentClass, setCurrentSession } = useClass()
  
  const classId = searchParams.get("classId")
  const className = searchParams.get("className")
  const setup = searchParams.get("setup") === "true"
  
  useEffect(() => {
    // Clear any existing session when entering teacher auth
    // Teachers should never have a session set
    setCurrentSession(null)
    if (setup) {
      setNeedsSetup(true)
    }
  }, [setup, setCurrentSession])
  
  useEffect(() => {
    if (!classId) {
      router.push("/")
    }
  }, [classId, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (needsSetup) {
        // Setting up new password
        const result = await setupTeacherPassword(classId!, password, confirmPassword)
        if (result.success) {
          router.push("/dashboard")
        } else {
          setError(result.error || "Failed to set password")
        }
      } else {
        // Verifying existing password
        const result = await verifyTeacherPassword(classId!, password)
        if (result.success) {
          // Password verified - show PIN screen
          // (We don't store teacherId yet - will get it from PIN)
          setShowPinScreen(true)
          setPassword("")
        } else if (result.needsSetup) {
          setNeedsSetup(true)
          setPassword("")
          setError("")
        } else {
          setError(result.error || "Incorrect password")
        }
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (!pin) {
        setError("Please enter your PIN")
        setIsLoading(false)
        return
      }

      // Find teacher account by PIN - the PIN is what identifies the teacher
      const supabase = createClient()
      const { data: teacher, error } = await supabase
        .from('teacher_accounts')
        .select('id, pin, first_name, email')
        .eq('pin', pin)
        .single()

      if (error || !teacher) {
        setError("PIN not found. Check the email sent to you.")
        setIsLoading(false)
        return
      }

      // Verify PIN matches (should always match since we queried by PIN, but double-check)
      if (teacher.pin !== pin) {
        setError("Incorrect PIN. Check the email sent to you.")
        setIsLoading(false)
        return
      }

      // PIN verified - store teacher in session and redirect to dashboard
      localStorage.setItem('teacher_authenticated', 'true')
      localStorage.setItem('teacher_id', teacher.id)
      localStorage.setItem('class_id', classId!)
      localStorage.setItem('teacher_name', teacher.first_name || 'Teacher')
      router.push("/dashboard")
    } catch (err) {
      console.error('[v0] PIN verification error:', err)
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!classId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              {showPinScreen ? <KeyRound className="w-8 h-8 text-white" /> : needsSetup ? <KeyRound className="w-8 h-8 text-white" /> : <Lock className="w-8 h-8 text-white" />}
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold mb-2">
              {showPinScreen ? "Enter PIN" : needsSetup ? "Set Up Password" : "Enter Password"}
            </CardTitle>
            <CardDescription className="text-base text-gray-600">
              {className || "Class"}
            </CardDescription>
            {showPinScreen && (
              <p className="text-sm text-gray-500 mt-2">
                Enter the PIN sent to your email to access your assigned subjects.
              </p>
            )}
            {needsSetup && (
              <p className="text-sm text-gray-500 mt-2">
                Create a password for your class. You will use this password to access your class in the future.
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {showPinScreen ? (
            <form onSubmit={handlePinSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">PIN</label>
                <Input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter your 4-digit PIN"
                  maxLength={4}
                  className="text-center text-2xl tracking-widest"
                  required
                />
                <p className="text-xs text-gray-500">You received this 4-digit PIN in your welcome email</p>
              </div>

              <Button
                type="submit"
                disabled={isLoading || pin.length !== 4}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
              >
                {isLoading ? "Verifying..." : "Access Subjects"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowPinScreen(false)
                  setPin("")
                  setError("")
                }}
                className="w-full text-gray-600"
              >
                Back to Password
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {needsSetup ? "New Password" : "Password"}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={needsSetup ? "Create a password" : "Enter your password"}
                    className="pr-10"
                    required
                    minLength={needsSetup ? 6 : 1}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {needsSetup && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !password || (needsSetup && !confirmPassword)}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
              >
                {isLoading ? "Please wait..." : needsSetup ? "Set Password & Continue" : "Login"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/")}
                className="w-full text-gray-600"
              >
                Back to Class Selection
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
