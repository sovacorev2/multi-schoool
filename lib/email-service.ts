/**
 * Email service for teacher notifications
 * 
 * This module calls the server-side API route which has access to RESEND_API_KEY
 * The actual email sending happens on the server, not the client
 */

interface TeacherAssignment {
  className: string
  subjectName: string
}

interface TeacherEmailData {
  email: string
  firstName: string
  lastName: string
  pin: string
  schoolName: string
  assignments: TeacherAssignment[]
}

/**
 * Send teacher welcome email via server-side API route
 * The server has direct access to RESEND_API_KEY environment variable
 */
export async function sendTeacherWelcomeEmail(
  data: TeacherEmailData,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    console.log('[v0] Calling server API to send email...')

    const response = await fetch('/api/send-teacher-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[v0] API error:', result)
      return { success: false, error: result.error || 'Failed to send email' }
    }

    console.log('[v0] Email sent successfully via API')
    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error('[v0] Error calling email API:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' }
  }
}
