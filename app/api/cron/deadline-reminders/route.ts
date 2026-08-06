import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verify authorization (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Get all sessions with deadlines closing within the next 24 hours
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const { data: upcomingDeadlines, error: deadlineError } = await supabase
      .from('sessions')
      .select('*, classes(name), exam_types(name)')
      .not('deadline_datetime', 'is', null)
      .gte('deadline_datetime', now.toISOString())
      .lte('deadline_datetime', tomorrow.toISOString())

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
        .eq('is_active', true)
        .not('user_id', 'is', null)

      if (assignmentError) {
        console.error('[v0] Error fetching assignments:', assignmentError)
        continue
      }

      if (!assignments || assignments.length === 0) continue

      // Get unique teacher IDs
      const teacherIds = [...new Set(assignments.map(a => a.user_id))]

      // Get teacher emails - teachers are stored in teacher_accounts, not a "users" table
      const { data: teachers, error: teacherError } = await supabase
        .from('teacher_accounts')
        .select('id, email, first_name, last_name')
        .in('id', teacherIds)
        .eq('is_active', true)

      if (teacherError) {
        console.error('[v0] Error fetching teachers:', teacherError)
        continue
      }

      if (!teachers || teachers.length === 0) continue

      // Send emails to each teacher
      for (const teacher of teachers) {
        if (!teacher.email) continue

        try {
          const emailResponse = await sendDeadlineEmail({
            teacherEmail: teacher.email,
            teacherName: [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') || 'Teacher',
            className: (deadline.classes as any)?.name || 'Class',
            examType: (deadline.exam_types as any)?.name || 'Exam',
            deadline: new Date(deadline.deadline_datetime).toLocaleString(),
            hoursUntilDeadline: Math.ceil(
              (new Date(deadline.deadline_datetime).getTime() - now.getTime()) / (1000 * 60 * 60)
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
  const emailHTML = `
    <h2>Deadline Reminder</h2>
    <p>Dear ${teacherName},</p>
    <p>This is a reminder that the deadline for entering marks for <strong>${examType}</strong> in <strong>${className}</strong> is approaching.</p>
    <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0;">
      <p><strong>Class:</strong> ${className}</p>
      <p><strong>Exam:</strong> ${examType}</p>
      <p><strong>Deadline:</strong> ${deadline}</p>
      <p><strong>Time remaining:</strong> ${hoursUntilDeadline} hour${hoursUntilDeadline === 1 ? '' : 's'}</p>
    </div>
    <p>Please log in to ShuleTech and complete the marks entry before the deadline.</p>
    <p>Best regards,<br/>ShuleTech</p>
  `

  try {
    if (!process.env.RESEND_API_KEY) {
      // Fallback: log only (development, or Resend not configured yet)
      console.log(`[v0] Email reminder (RESEND_API_KEY not set):
        To: ${teacherEmail}
        Subject: Deadline Reminder: ${examType} - ${className}
        Hours until deadline: ${hoursUntilDeadline}
      `)
      return { success: true }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const response = await resend.emails.send({
      from: 'ShuleTech <noreply@shuletechsolutions.co.ke>',
      to: teacherEmail,
      subject: `Deadline Reminder: ${examType} - ${className}`,
      html: emailHTML,
    })

    if (response.error) {
      console.error('[v0] Resend API error:', response.error)
      return { success: false }
    }

    return { success: true }
  } catch (error) {
    console.error('[v0] Email sending error:', error)
    return { success: false }
  }
}
