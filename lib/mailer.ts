import nodemailer from 'nodemailer'
import { Resend } from 'resend'

// Server-only. Sends through Zoho SMTP when it's configured (ZOHO_SMTP_USER/
// ZOHO_SMTP_PASSWORD) - shuletechsolutions.co.ke was never verified on
// Resend, so every Resend send from noreply@shuletechsolutions.co.ke fails
// with "domain is not verified" (teacher PIN emails and deadline reminders
// had been silently failing because of it). Same fix lib/requisition/email.ts
// already made. Resend stays as the fallback for setups without Zoho.

export interface MailResult {
  success: boolean
  error?: string
  messageId?: string
}

export async function sendMail({ to, subject, html, fromName = 'ShuleTech' }: { to: string | string[]; subject: string; html: string; fromName?: string }): Promise<MailResult> {
  try {
    if (process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
        port: Number(process.env.ZOHO_SMTP_PORT) || 465,
        secure: true,
        auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASSWORD },
      })
      const info = await transporter.sendMail({
        from: `"${fromName}" <${process.env.ZOHO_SMTP_FROM || process.env.ZOHO_SMTP_USER}>`,
        to,
        subject,
        html,
      })
      return { success: true, messageId: info.messageId }
    }

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const response = await resend.emails.send({
        from: `${fromName} <noreply@shuletechsolutions.co.ke>`,
        to,
        subject,
        html,
      })
      if (response.error) return { success: false, error: response.error.message }
      return { success: true, messageId: response.data?.id }
    }

    return { success: false, error: 'No email provider configured (set ZOHO_SMTP_USER/ZOHO_SMTP_PASSWORD)' }
  } catch (error) {
    console.error('[mailer] send failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' }
  }
}
