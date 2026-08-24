import { Resend } from 'resend'
import type { RequisitionProfile, Requisition } from './types'

// Reuses the same verified sender domain and RESEND_API_KEY already
// configured for deadline-reminder and teacher-welcome emails elsewhere in
// this app - no separate email provider needed for this feature.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function baseTemplate(bodyHtml: string) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #171717;">
      <div style="background: #1e3a8a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <span style="color: #fff; font-size: 18px; font-weight: bold;">ShuleTech Requisitions</span>
      </div>
      <div style="border: 1px solid #e5e5e5; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        ${bodyHtml}
      </div>
      <p style="color: #a3a3a3; font-size: 12px; margin-top: 16px;">This is an automated notification from the ShuleTech internal requisitions system.</p>
    </div>
  `
}

export async function sendRequisitionSubmitted(approver: RequisitionProfile, requisition: Requisition, requester: RequisitionProfile) {
  const link = `${appUrl()}/requisition/requisitions/${requisition.id}`
  const html = baseTemplate(`
    <p>Hi ${approver.full_name.split(' ')[0]},</p>
    <p><strong>${requester.full_name}</strong> has submitted a new ${requisition.type} requisition awaiting your decision:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 6px 0; color: #737373;">Title</td><td style="padding: 6px 0; font-weight: 600;">${requisition.title}</td></tr>
      <tr><td style="padding: 6px 0; color: #737373;">Type</td><td style="padding: 6px 0;">${requisition.type === 'goods' ? 'Goods' : 'Cash'}</td></tr>
      <tr><td style="padding: 6px 0; color: #737373;">Amount</td><td style="padding: 6px 0; font-weight: 600;">${formatKES(requisition.amount)}</td></tr>
    </table>
    <a href="${link}" style="display: inline-block; background: #1e3a8a; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review requisition</a>
  `)

  await getResend().emails.send({
    from: 'ShuleTech Requisitions <noreply@shuletechsolutions.co.ke>',
    to: approver.email,
    subject: `New requisition from ${requester.full_name}: ${requisition.title}`,
    html,
  })
}

export async function sendRequisitionDecided(everyone: RequisitionProfile[], requisition: Requisition, requester: RequisitionProfile, decider: RequisitionProfile) {
  const link = `${appUrl()}/requisition/requisitions/${requisition.id}`
  const approved = requisition.status === 'approved'
  const html = baseTemplate(`
    <p>${requester.full_name}'s ${requisition.type} requisition <strong>"${requisition.title}"</strong> (${formatKES(requisition.amount)}) has been
      <strong style="color: ${approved ? '#16a34a' : '#dc2626'};">${approved ? 'APPROVED' : 'DECLINED'}</strong>
      by ${decider.full_name}.
    </p>
    ${requisition.remarks ? `<p style="background: #f5f5f5; border-left: 3px solid #a3a3a3; padding: 10px 14px; margin: 16px 0;"><strong>Remarks:</strong> ${requisition.remarks}</p>` : ''}
    <a href="${link}" style="display: inline-block; background: #1e3a8a; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">View requisition</a>
  `)

  await getResend().emails.send({
    from: 'ShuleTech Requisitions <noreply@shuletechsolutions.co.ke>',
    to: everyone.map((p) => p.email),
    subject: `${approved ? 'Approved' : 'Declined'}: ${requisition.title} (${requester.full_name})`,
    html,
  })
}
