import { createClient } from '@/lib/supabase/server'

/**
 * Generate a unique 4-digit PIN
 * Ensures the PIN doesn't already exist in the database
 */
export async function generateUniquePIN(): Promise<string> {
  const supabase = createClient()
  
  let pin: string
  let isUnique = false
  let attempts = 0
  const maxAttempts = 100

  while (!isUnique && attempts < maxAttempts) {
    // Generate random 4-digit PIN (0000-9999)
    pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    
    // Check if PIN already exists
    const { data, error } = await supabase
      .from('teacher_accounts')
      .select('id')
      .eq('pin', pin)
      .single()

    // If no data found, PIN is unique
    if (error && error.code === 'PGRST116') {
      isUnique = true
    }
    
    attempts++
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique PIN after multiple attempts')
  }

  return pin!
}

/**
 * Verify a PIN and return teacher details with assignments
 */
export async function verifyTeacherPIN(pin: string, schoolId: string) {
  const supabase = createClient()

  const { data: teacher, error } = await supabase
    .from('teacher_accounts')
    .select(`
      id,
      first_name,
      last_name,
      email,
      school_id,
      is_active,
      teacher_assignments(
        id,
        class_id,
        subject_id,
        classes(id, name),
        subjects(id, name)
      )
    `)
    .eq('pin', pin)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .single()

  if (error) {
    return { success: false, error: 'Invalid PIN or teacher not found' }
  }

  if (!teacher) {
    return { success: false, error: 'Teacher account not found' }
  }

  return { success: true, teacher }
}
