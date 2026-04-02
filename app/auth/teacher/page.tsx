"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useClass } from "@/lib/class-context"
import { verifyTeacherPassword, setupTeacherPassword } from "@/app/actions/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, Eye, EyeOff, KeyRound } from "lucide-react"

export default function TeacherAuthPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsSetup, setNeedsSetup] = useState(false)
  
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
          router.push("/dashboard")
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

  if (!classId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              {needsSetup ? <KeyRound className="w-8 h-8 text-white" /> : <Lock className="w-8 h-8 text-white" />}
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold mb-2">
              {needsSetup ? "Set Up Password" : "Enter Password"}
            </CardTitle>
            <CardDescription className="text-base text-gray-600">
              {className || "Class"}
            </CardDescription>
            {needsSetup && (
              <p className="text-sm text-gray-500 mt-2">
                Create a password for your class. You will use this password to access your class in the future.
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}
