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

export async function verifyAdminPassword(password: string, schoolId?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // The admin password lives in school_credentials, not on the schools row
  // itself - schools is read directly from the browser via the anon key
  // across dozens of call sites, and a table that anon can freely SELECT is
  // never a safe place for a credential no matter how the column itself is
  // locked down (Realtime's postgres_changes subscriptions in particular
  // broadcast full rows, bypassing column-level grants entirely). Splitting
  // it into its own table - with no anon/authenticated grants at all -
  // means schools keeps working exactly as before for every other field,
  // and the password is only ever reachable through this action's use of
  // the service-role client. schoolId is passed from the marklist page
  // context; if omitted we try to find any school whose password matches
  // (fallback for legacy callers).
  let adminPassword: string | null = null

  if (schoolId) {
    const { data, error } = await supabase
      .from("school_credentials")
      .select("admin_password")
      .eq("school_id", schoolId)
      .single()
    if (error) {
      console.error('[verifyAdminPassword] school_credentials query failed', { schoolId, code: error.code, message: error.message })
      return { success: false, error: "Something went wrong verifying the password. Please try again." }
    }
    adminPassword = data?.admin_password ?? null
  } else {
    // Fallback: check all schools - used when schoolId is not available
    const { data } = await supabase
      .from("school_credentials")
      .select("school_id, admin_password")
    const match = data?.find(s => s.admin_password && s.admin_password === password)
    if (match) {
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

  if (adminPassword && password === adminPassword) {
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

export async function verifyTeacherPassword(classId: string, password: string): Promise<{ success: boolean; error?: string; needsSetup?: boolean; teacher_id?: string; pinEnabled?: boolean }> {
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
  
  // Get school info to check if PIN is enabled
  const { data: schoolData } = await supabase
    .from("schools")
    .select("enable_pin_login")
    .eq("id", classData.school_id)
    .single()
  
  const pinEnabled = schoolData?.enable_pin_login || false
  console.log('[v0] PIN check:', { classId, schoolId: classData.school_id, pinEnabled })
  
  // Try plain text comparison first (for passwords set via admin portal like "welcome")
  if (password === storedPassword) {
    // Get the actual teacher ID for this class
    const { data: teacher } = await supabase
      .from('teacher_accounts')
      .select('id')
      .ilike('first_name', (classData.teacher_name || '').split(' ')[0]) // Match first name
      .eq('school_id', classData.school_id)
      .single()
    
    const teacherId = teacher?.id || classId
    console.log('[v0] Password verified. Teacher ID:', teacherId, 'Class:', classId)
    
    const cookieStore = await cookies()
    cookieStore.set("teacher_auth", JSON.stringify({ classId, authenticated: true }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
    })
    return { success: true, teacher_id: teacherId, pinEnabled }
  }
  
  // Also try hashed password (for backwards compatibility with passwords set by teachers)
  if (verifyHash(password, storedPassword)) {
    // Get the actual teacher ID for this class
    const { data: teacher } = await supabase
      .from('teacher_accounts')
      .select('id')
      .ilike('first_name', (classData.teacher_name || '').split(' ')[0]) // Match first name
      .eq('school_id', classData.school_id)
      .single()
    
    const teacherId = teacher?.id || classId
    console.log('[v0] Hashed password verified. Teacher ID:', teacherId, 'Class:', classId)
    
    const cookieStore = await cookies()
    cookieStore.set("teacher_auth", JSON.stringify({ classId, authenticated: true }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
    })
    return { success: true, teacher_id: teacherId, pinEnabled }
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

export interface TeacherPinLoginResult {
  success: boolean
  error?: string
  teacher?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  assignments?: { id: string; classId: string; subjectId: string | null; className: string; subjectName: string | null }[]
}

/**
 * Full teacher PIN login: verifies the PIN (and, for schools that gate PIN
 * login behind a shared "welcome" password, that password too) and returns
 * everything the teacher dashboard needs to build its session - without the
 * browser ever needing SELECT access to teacher_accounts.pin or
 * school_credentials.admin_password itself. Replaces what used to be
 * several near-identical direct Supabase queries duplicated across
 * app/teacher-pin-login/page.tsx and app/teacher-login/page.tsx.
 */
export async function teacherPinLogin(
  schoolId: string,
  pin: string,
  adminPassword?: string
): Promise<TeacherPinLoginResult> {
  const supabase = await createClient()

  if (adminPassword !== undefined) {
    const { data: cred } = await supabase
      .from('school_credentials')
      .select('admin_password')
      .eq('school_id', schoolId)
      .single()
    if (!cred || cred.admin_password !== adminPassword) {
      return { success: false, error: 'Invalid welcome password. Please try again.' }
    }
  }

  const { data: teacher, error: teacherError } = await supabase
    .from('teacher_accounts')
    .select('id, first_name, last_name, email, is_active')
    .eq('pin', pin)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .single()

  if (teacherError || !teacher) {
    return { success: false, error: 'Invalid PIN or teacher not found. Please check and try again.' }
  }

  const { data: assignments } = await supabase
    .from('teacher_assignments')
    .select('id, class_id, subject_id')
    .eq('user_id', teacher.id)
    .eq('school_id', schoolId)
    .eq('is_active', true)

  const classIds = [...new Set((assignments || []).map(a => a.class_id))]
  const subjectIds = [...new Set((assignments || []).map(a => a.subject_id).filter(Boolean))]

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    classIds.length > 0 ? supabase.from('classes').select('id, name').in('id', classIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    subjectIds.length > 0 ? supabase.from('subjects').select('id, name').in('id', subjectIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const classNameById = new Map((classes || []).map(c => [c.id, c.name]))
  const subjectNameById = new Map((subjects || []).map(s => [s.id, s.name]))

  return {
    success: true,
    teacher: {
      id: teacher.id,
      firstName: teacher.first_name,
      lastName: teacher.last_name || '',
      email: teacher.email,
    },
    assignments: (assignments || []).map(a => ({
      id: a.id,
      classId: a.class_id,
      subjectId: a.subject_id,
      className: classNameById.get(a.class_id) || '',
      subjectName: a.subject_id ? (subjectNameById.get(a.subject_id) || null) : null,
    })),
  }
}

/**
 * Creates a new teacher account with a server-generated PIN - the browser
 * never needs SELECT access to teacher_accounts.pin to check uniqueness the
 * way the old client-side "generate and check" loop did. Returns the
 * generated PIN once, for the admin to relay/email to the teacher.
 */
export async function createTeacherAccount(
  schoolId: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<{ success: boolean; error?: string; teacher?: { id: string; pin: string } }> {
  const supabase = await createClient()

  let pin = ''
  let isUnique = false
  for (let attempts = 0; attempts < 100 && !isUnique; attempts++) {
    pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    const { data: existing } = await supabase
      .from('teacher_accounts')
      .select('id')
      .eq('pin', pin)
      .eq('school_id', schoolId)
    isUnique = !existing || existing.length === 0
  }
  if (!isUnique) {
    return { success: false, error: 'Failed to generate a unique PIN. Please try again.' }
  }

  const { data, error } = await supabase
    .from('teacher_accounts')
    .insert([{
      school_id: schoolId,
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName || '',
      pin,
    }])
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('unique')) {
      return { success: false, error: 'This email is already registered' }
    }
    return { success: false, error: error.message }
  }

  return { success: true, teacher: { id: data.id, pin } }
}

/** The admin-portal teacher-accounts page legitimately shows each teacher's
 * PIN (with a copy button) so the admin can relay it - that's a real,
 * intentional use of teacher_accounts.pin, unlike the login flows this
 * column was locked down against. Since there's no session-based way to
 * tell "an authenticated school admin" apart from anyone else at the
 * database role level (this app doesn't use Supabase Auth sessions), that
 * distinction has to be made here, gated by the same admin_auth cookie the
 * admin-portal itself requires, rather than by loosening the column grant
 * for anon in general. Returns a school_id-scoped map so a page can't
 * accidentally pull another school's PINs. */
export async function getTeacherPinsForSchool(schoolId: string): Promise<Record<string, string>> {
  if (!(await checkAdminAuth())) return {}
  const supabase = await createClient()
  const { data } = await supabase
    .from('teacher_accounts')
    .select('id, pin')
    .eq('school_id', schoolId)
  const result: Record<string, string> = {}
  for (const row of data || []) result[row.id] = row.pin
  return result
}

/** Mirrors getTeacherPinsForSchool - admin-portal's "Access & Passwords" page
 * legitimately shows each class's current password in a table, gated by the
 * same admin_auth cookie the rest of the admin portal requires. */
export async function getClassPasswordsForSchool(schoolId: string): Promise<Record<string, string | null>> {
  if (!(await checkAdminAuth())) return {}
  const supabase = await createClient()
  const { data } = await supabase
    .from('classes')
    .select('id, password')
    .eq('school_id', schoolId)
  const result: Record<string, string | null> = {}
  for (const row of data || []) result[row.id] = row.password
  return result
}

export async function setupTeacherPassword(classId: string, password: string, confirmPassword: string): Promise<{ success: boolean; error?: string; teacher_id?: string }> {
  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match" }
  }
  
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" }
  }
  
  const supabase = await createClient()
  
  // Check if password already set and get class/school info
  const { data: classData } = await supabase
    .from("classes")
    .select("password, teacher_name, school_id")
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
  
  // Get the actual teacher ID for this class
  const { data: teacher } = await supabase
    .from('teacher_accounts')
    .select('id')
    .ilike('first_name', (classData.teacher_name || '').split(' ')[0])
    .eq('school_id', classData.school_id)
    .single()
  
  const teacherId = teacher?.id || classId
  
  // Set auth cookie
  const cookieStore = await cookies()
  cookieStore.set("teacher_auth", JSON.stringify({ classId, authenticated: true }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  })
  
  return { success: true, teacher_id: teacherId }
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

export async function changeAdminPassword(currentPassword: string, newPassword: string, schoolId?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  if (newPassword.length < 4) {
    return { success: false, error: "New password must be at least 4 characters" }
  }

  // Verify current password against school_credentials.admin_password
  const query = schoolId
    ? supabase.from("school_credentials").select("school_id, admin_password").eq("school_id", schoolId).single()
    : supabase.from("school_credentials").select("school_id, admin_password").limit(1).single()

  const { data: credData, error: fetchErr } = await query
  if (fetchErr || !credData) {
    return { success: false, error: "School not found" }
  }

  if (currentPassword !== credData.admin_password) {
    return { success: false, error: "Current password is incorrect" }
  }

  const { error } = await supabase
    .from("school_credentials")
    .update({ admin_password: newPassword })
    .eq("school_id", credData.school_id)

  if (error) {
    return { success: false, error: "Failed to update password" }
  }

  return { success: true }
}

/** Super-admin resetting a school's admin password directly - unlike
 * changeAdminPassword, doesn't require knowing the current one. Upserts
 * since a school created before school_credentials existed may not have a
 * row yet. */
export async function setSchoolAdminPassword(schoolId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!(await checkSuperAdminAuth())) {
    return { success: false, error: "Not authorized" }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("school_credentials")
    .upsert({ school_id: schoolId, admin_password: newPassword }, { onConflict: "school_id" })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** app/setup-school's onboarding flow setting the brand-new school's initial
 * admin password, right after creating the schools row itself (client-side,
 * unchanged) - school_credentials has no anon INSERT grant, so this has to
 * go through a server action even for a school that didn't exist a moment
 * ago. */
export async function createSchoolCredentials(schoolId: string, adminPassword: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("school_credentials")
    .insert({ school_id: schoolId, admin_password: adminPassword })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** admin-portal's own "Access & Passwords" page setting a new admin
 * password for the school it's already authenticated into - gated by the
 * same admin_auth cookie the portal itself requires (checkAdminAuth),
 * unlike setSchoolAdminPassword above which is super-admin only. */
export async function updateAdminPasswordForCurrentSchool(schoolId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!(await checkAdminAuth())) {
    return { success: false, error: "Not authorized" }
  }
  if (newPassword.length < 4) {
    return { success: false, error: "Password must be at least 4 characters" }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("school_credentials")
    .upsert({ school_id: schoolId, admin_password: newPassword }, { onConflict: "school_id" })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

const SUPER_ADMIN_COOKIE = "super_admin_auth"

/** The super-admin password used to live as a literal string constant in
 * app/super-admin/_shared/auth.ts, shipped straight into the client JS
 * bundle - readable by anyone who opened dev tools on /super-admin, no
 * database access needed at all. Reading it from a server-only env var and
 * verifying it here means it never reaches the browser in any form. */
export async function verifySuperAdminPassword(password: string): Promise<{ success: boolean; error?: string }> {
  const expected = process.env.SUPER_ADMIN_PASSWORD
  if (!expected) {
    console.error('[auth] SUPER_ADMIN_PASSWORD is not configured')
    return { success: false, error: "Super-admin login is not configured. Set SUPER_ADMIN_PASSWORD." }
  }
  if (password !== expected) {
    return { success: false, error: "Invalid password" }
  }
  const cookieStore = await cookies()
  cookieStore.set(SUPER_ADMIN_COOKIE, JSON.stringify({ authenticated: true, role: "super_admin" }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  })
  return { success: true }
}

export async function checkSuperAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get(SUPER_ADMIN_COOKIE)
  if (!authCookie) return false
  try {
    const auth = JSON.parse(authCookie.value)
    return auth.authenticated === true && auth.role === "super_admin"
  } catch {
    return false
  }
}

export async function logoutSuperAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SUPER_ADMIN_COOKIE)
}

export interface PaymentHistoryRow {
  id: string
  amount: number
  phone_number: string | null
  ncba_transaction_id: string | null
  status: 'pending' | 'success' | 'failed'
  initiated_at: string
  completed_at: string | null
}

/** Super-admin-only read of a school's payment history - payment_transactions
 * holds real M-Pesa/NCBA phone numbers and transaction records, so this goes
 * through the service-role client with its own auth check rather than a
 * direct anon-key query from the browser. */
export async function getPaymentHistory(schoolId: string): Promise<PaymentHistoryRow[]> {
  if (!(await checkSuperAdminAuth())) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('payment_transactions')
    .select('id, amount, phone_number, ncba_transaction_id, status, initiated_at, completed_at')
    .eq('school_id', schoolId)
    .order('initiated_at', { ascending: false })
    .limit(20)
  return data || []
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
