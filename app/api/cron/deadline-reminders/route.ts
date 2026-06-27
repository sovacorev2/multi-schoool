import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TeacherAssignment {
  teacher_id: string
  teacher_email?: string
  teacher_name?: string
  class_id: string
  class_name?: string
}

export async function GET(request: Request) {
  // Verify authorization (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Get all sessions with deadlines set to close within 24 hours
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const { data: upcomingDeadlines, error: deadlineError } = await supabase
      .from('sessions')
      .select('*, classes(name), exam_types(name)')
      .not('deadline', 'is', null)
      .gte('deadline', now.toISOString())
      .lte('deadline', tomorrow.toISOString())

    if (deadlineError) {
      console.error('[v0] Error fetching deadlines:', deadlineError)
      return NextResponse.json({ error: 'Failed to fetch deadlines' }, { status: 500 })
    }

    if (!upcomingDeadlines || upcomingDeadlines.length === 0) {
      return NextResponse.json({ message: 'No upcoming deadlines', count: 0 })
    }

    let notificationsSent = 0

    // For each deadline, get assigned teachers and send emails
    for (const deadline of upcomingDeadlines) {
      if (!deadline.class_id) continue

      // Get teachers assigned to this class
      const { data: assignments, error: assignmentError } = await supabase
        .from('teacher_assignments')
        .select('user_id')
        .eq('class_id', deadline.class_id)
        .not('user_id', 'is', null)

      if (assignmentError) {
        console.error('[v0] Error fetching assignments:', assignmentError)
        continue
      }

      if (!assignments || assignments.length === 0) continue

      // Get unique teacher IDs
      const teacherIds = [...new Set(assignments.map(a => a.user_id))]

      // Get teacher emails
      const { data: teachers, error: teacherError } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', teacherIds)

      if (teacherError) {
        console.error('[v0] Error fetching teachers:', teacherError)
        continue
      }

      if (!teachers || teachers.length === 0) continue

      // Send emails to each teacher
      for (const teacher of teachers) {
        if (!teacher.email) continue

        try {
          // Send email via Resend (if configured) or log for now
          const emailResponse = await sendDeadlineEmail({
            teacherEmail: teacher.email,
            teacherName: teacher.name || 'Teacher',
            className: (deadline.classes as any)?.name || 'Class',
            examType: (deadline.exam_types as any)?.name || 'Exam',
            deadline: new Date(deadline.deadline).toLocaleString(),
            hoursUntilDeadline: Math.ceil(
              (new Date(deadline.deadline).getTime() - now.getTime()) / (1000 * 60 * 60)
            ),
          })

          if (emailResponse.success) {
            notificationsSent++
            console.log(`[v0] Email sent to ${teacher.email}`)
          }
        } catch (error) {
          console.error(`[v0] Failed to send email to ${teacher.email}:`, error)
        }
      }
    }

    return NextResponse.json({
      message: 'Deadline reminders processed',
      deadlinesFound: upcomingDeadlines.length,
      notificationsSent,
    })
  } catch (error) {
    console.error('[v0] Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

async function sendDeadlineEmail({
  teacherEmail,
  teacherName,
  className,
  examType,
  deadline,
  hoursUntilDeadline,
}: {
  teacherEmail: string
  teacherName: string
  className: string
  examType: string
  deadline: string
  hoursUntilDeadline: number
}): Promise<{ success: boolean }> {
  try {
    // If Resend is configured, use it
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'noreply@exam-system.com',
          to: teacherEmail,
          subject: `Deadline Reminder: ${examType} - ${className}`,
          html: `
            <h2>Deadline Reminder</h2>
            <p>Dear ${teacherName},</p>
            <p>This is a reminder that the deadline for entering marks for <strong>${examType}</strong> in <strong>${className}</strong> is approaching.</p>
            <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0;">
              <p><strong>Class:</strong> ${className}</p>
              <p><strong>Exam:</strong> ${examType}</p>
              <p><strong>Deadline:</strong> ${deadline}</p>
              <p><strong>Time remaining:</strong> ${hoursUntilDeadline} hours</p>
            </div>
            <p>Please log in to the exam system and complete the marks entry before the deadline.</p>
            <p>Best regards,<br/>Exam System</p>
          `,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[v0] Resend API error:', error)
        return { success: false }
      }

      return { success: true }
    }

    // Fallback: Just log (for development without email service)
    console.log(`[v0] Email reminder (development mode):
      To: ${teacherEmail}
      Subject: Deadline Reminder: ${examType} - ${className}
      Hours until deadline: ${hoursUntilDeadline}
    `)

    return { success: true }
  } catch (error) {
    console.error('[v0] Email sending error:', error)
    return { success: false }
  }
}
