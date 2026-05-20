"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

// Simple hash function for passwords (for demo - in production use bcrypt)
function simpleHash(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16) + "_" + password.length + "_" + Buffer.from(password).toString('base64')
}

function verifyHash(password: string, hash: string): boolean {
  return simpleHash(password) === hash
}

// Classes that use individual passwords (lower grades set their own)
const LOWER_GRADE_CLASSES = ["PP1", "PP2", "Grade 1", "Grade 2", "Grade 3"]

// Helper to get admin password from database
async function getAdminPassword(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "admin_password")
    .single()
  return data?.value || "admin26"
}

export async function verifyTeacherPassword(classId: string, password: string): Promise<{ success: boolean; error?: string; needsSetup?: boolean; teacher_id?: string }> {
  const supabase = await createClient()
  
  // Get class info
  const { data: classData, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .single()
  
  if (error || !classData) {
    return { success: false, error: "Class not found" }
  }
  
  // Get the stored password
  const storedPassword = classData.password
  
  if (!storedPassword) {
    // Password not set yet, needs setup
    return { success: false, needsSetup: true }
  }
  
  // Try plain text comparison first (for passwords set via admin portal like "welcome")
  if (password === storedPassword) {
    const cookieStore = await cookies()
    cookieStore.set("teacher_auth", JSON.stringify({ classId, authenticated: true }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
    })
    return { success: true, teacher_id: classId }
  }
  
  // Also try hashed password (for backwards compatibility with passwords set by teachers)
  if (verifyHash(password, storedPassword)) {
    const cookieStore = await cookies()
    cookieStore.set("teacher_auth", JSON.stringify({ classId, authenticated: true }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
    })
    return { success: true, teacher_id: classId }
  }
  
  return { success: false, error: "Incorrect password" }
}

export async function verifyTeacherPin(pin: string): Promise<{ success: boolean; error?: string; teacher_id?: string; teacher_name?: string }> {
  const supabase = await createClient()
  
  try {
    // Find teacher by PIN
    const { data: teacher, error } = await supabase
      .from('teacher_accounts')
      .select('id, pin, first_name, email')
      .eq('pin', pin)
      .single()

    if (error || !teacher) {
      return { success: false, error: "PIN not found. Check the email sent to you." }
    }

    // Verify PIN matches
    if (teacher.pin !== pin) {
      return { success: false, error: "Incorrect PIN." }
    }

    // PIN verified successfully
    return { 
      success: true, 
      teacher_id: teacher.id,
      teacher_name: teacher.first_name || 'Teacher'
    }
  } catch (err) {
    console.error('[v0] PIN verification error:', err)
    return { success: false, error: "An error occurred during PIN verification." }
  }
}

export async function setupTeacherPassword(classId: string, password: string, confirmPassword: string): Promise<{ success: boolean; error?: string }> {
  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match" }
  }
  
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" }
  }
  
  const supabase = await createClient()
  
  // Check if password already set
  const { data: classData } = await supabase
    .from("classes")
    .select("password")
    .eq("id", classId)
    .single()
  
  if (classData?.password) {
    return { success: false, error: "Password already set. Contact admin to reset." }
  }
  
  // Set the password
  const passwordHash = simpleHash(password)
  const { error } = await supabase
    .from("classes")
    .update({ password: passwordHash })
    .eq("id", classId)
  
  if (error) {
    return { success: false, error: "Failed to set password" }
  }
  
  // Set auth cookie
  const cookieStore = await cookies()
  cookieStore.set("teacher_auth", JSON.stringify({ classId, authenticated: true }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  })
  
  return { success: true }
}

export async function verifyAdminPassword(password: string): Promise<{ success: boolean; error?: string }> {
  const adminPassword = await getAdminPassword()
  
  if (password === adminPassword) {
    const cookieStore = await cookies()
    cookieStore.set("admin_auth", JSON.stringify({ authenticated: true, role: "admin" }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
    })
    return { success: true }
  }
  return { success: false, error: "Incorrect admin password" }
}

export async function checkTeacherAuth(classId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get("teacher_auth")
  
  if (!authCookie) return false
  
  try {
    const auth = JSON.parse(authCookie.value)
    return auth.classId === classId && auth.authenticated === true
  } catch {
    return false
  }
}

export async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get("admin_auth")
  
  if (!authCookie) return false
  
  try {
    const auth = JSON.parse(authCookie.value)
    return auth.authenticated === true && auth.role === "admin"
  } catch {
    return false
  }
}

export async function logoutTeacher(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete("teacher_auth")
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete("admin_auth")
}

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  // Verify current password
  const adminPassword = await getAdminPassword()
  if (currentPassword !== adminPassword) {
    return { success: false, error: "Current password is incorrect" }
  }
  
  if (newPassword.length < 4) {
    return { success: false, error: "New password must be at least 4 characters" }
  }
  
  // Update the password in the database
  const { error } = await supabase
    .from("admin_settings")
    .update({ value: newPassword, updated_at: new Date().toISOString() })
    .eq("key", "admin_password")
  
  if (error) {
    return { success: false, error: "Failed to update password" }
  }
  
  return { success: true }
}

export async function resetClassPassword(classId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("classes")
    .update({ password: null })
    .eq("id", classId)
  
  if (error) {
    return { success: false, error: "Failed to reset password" }
  }
  
  return { success: true }
}

export async function getClassesForPasswordManagement(): Promise<{ id: string; name: string; hasPassword: boolean }[]> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("classes")
    .select("id, name, password")
    .order("display_order")
  
  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    hasPassword: !!c.password
  }))
}
