import nodemailer from 'nodemailer'
import type { RequisitionProfile, Requisition } from './types'

// Sends through Zoho's own SMTP servers using an app-specific password on
// one mailbox (ZOHO_SMTP_USER) - Resend was tried first (reusing the
// deadline-reminder feature's setup) but shuletechsolutions.co.ke was never
// actually verified there, so those sends were failing silently. Zoho's
// domain reputation/SPF/DKIM are already correctly configured for real mail
// flow, so sending through Zoho itself avoids repeating that problem.
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
    port: Number(process.env.ZOHO_SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASSWORD,
    },
  })
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// STEMS brand colors (navy + teal) as accent bars/buttons only - no logo
// image in emails, per product decision, so the message stays a plain,
// fast-loading text email rather than depending on image rendering.
const NAVY = '#14213d'
const TEAL = '#0e9ca6'

function baseTemplate(bodyHtml: string) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
      <div style="height: 4px; background: linear-gradient(90deg, ${NAVY}, ${TEAL});"></div>
      <div style="padding: 20px 28px 12px; border-bottom: 1px solid #e5e5e5;">
        <span style="font-size: 15px; font-weight: 700; color: ${NAVY}; letter-spacing: 0.03em;">STEMS</span>
        <span style="font-size: 13px; color: #737373;"> &middot; Requisitions</span>
      </div>
      <div style="padding: 24px 28px; color: #262626; font-size: 14px; line-height: 1.6;">
        ${bodyHtml}
      </div>
      <div style="padding: 16px 28px; border-top: 1px solid #e5e5e5; background: #fafafa;">
        <p style="color: #a3a3a3; font-size: 11px; margin: 0;">Automated notification from the ShuleTech internal requisitions system. Do not reply to this email.</p>
      </div>
    </div>
  `
}

function detailsTable(rows: [string, string][]) {
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 18px 0; border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden;">
      ${rows.map(([label, value], i) => `
        <tr style="${i % 2 === 0 ? 'background: #fafafa;' : ''}">
          <td style="padding: 10px 14px; color: #737373; font-size: 13px; width: 35%; border-bottom: ${i < rows.length - 1 ? '1px solid #e5e5e5' : 'none'};">${label}</td>
          <td style="padding: 10px 14px; font-weight: 600; font-size: 13px; border-bottom: ${i < rows.length - 1 ? '1px solid #e5e5e5' : 'none'};">${value}</td>
        </tr>
      `).join('')}
    </table>
  `
}

function ctaButton(href: string, label: string) {
  return `<a href="${href}" style="display: inline-block; background: ${NAVY}; color: #fff; padding: 11px 22px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 4px;">${label}</a>`
}

function paymentRows(requisition: Requisition): [string, string][] {
  if (!requisition.payment_method) return []
  if (requisition.payment_method === 'bank' && requisition.payment_details) {
    return [
      ['Payment method', 'Bank transfer'],
      ['Bank', requisition.payment_details.bank_name || ''],
      ['Account number', requisition.payment_details.account_number || ''],
      ['Account name', requisition.payment_details.account_name || ''],
    ]
  }
  if (requisition.payment_method === 'mobile_money' && requisition.payment_details) {
    return [
      ['Payment method', 'Mobile money (M-Pesa)'],
      ['Recipient', requisition.payment_details.recipient_name || ''],
      ['Phone number', requisition.payment_details.phone_number || ''],
    ]
  }
  return [['Payment method', 'Cash']]
}

export async function sendRequisitionSubmitted(approver: RequisitionProfile, requisition: Requisition, requester: RequisitionProfile) {
  const link = `${appUrl()}/requisition/requisitions/${requisition.id}`
  const html = baseTemplate(`
    <p style="margin: 0 0 12px;">Hi ${approver.full_name.split(' ')[0]},</p>
    <p style="margin: 0 0 4px;"><strong>${requester.full_name}</strong> has submitted a new requisition awaiting your decision.</p>
    ${detailsTable([
      ['Title', requisition.title],
      ['Type', requisition.type === 'goods' ? 'Goods' : 'Cash'],
      ['Amount', formatKES(requisition.amount)],
      ...paymentRows(requisition),
    ])}
    ${ctaButton(link, 'Review requisition')}
  `)

  await getTransporter().sendMail({
    from: `"STEMS Requisitions" <${process.env.ZOHO_SMTP_FROM || process.env.ZOHO_SMTP_USER}>`,
    to: approver.email,
    subject: `New requisition from ${requester.full_name}: ${requisition.title}`,
    html,
  })
}

export async function sendRequisitionDecided(everyone: RequisitionProfile[], requisition: Requisition, requester: RequisitionProfile, decider: RequisitionProfile) {
  const link = `${appUrl()}/requisition/requisitions/${requisition.id}`
  const approved = requisition.status === 'approved'
  const statusColor = approved ? '#16a34a' : '#dc2626'
  const html = baseTemplate(`
    <p style="margin: 0 0 12px;">
      ${requester.full_name}'s requisition <strong>"${requisition.title}"</strong> has been
      <span style="display: inline-block; background: ${statusColor}; color: #fff; padding: 2px 10px; border-radius: 4px; font-weight: 700; font-size: 12px; letter-spacing: 0.03em;">${approved ? 'APPROVED' : 'DECLINED'}</span>
      by ${decider.full_name}.
    </p>
    ${detailsTable([
      ['Type', requisition.type === 'goods' ? 'Goods' : 'Cash'],
      ['Amount', formatKES(requisition.amount)],
    ])}
    ${requisition.remarks ? `<div style="background: #fafafa; border-left: 3px solid ${TEAL}; padding: 10px 14px; margin: 16px 0; border-radius: 0 6px 6px 0;"><strong style="font-size: 12px; color: #737373;">REMARKS</strong><p style="margin: 4px 0 0;">${requisition.remarks}</p></div>` : ''}
    ${ctaButton(link, 'View requisition')}
  `)

  await getTransporter().sendMail({
    from: `"STEMS Requisitions" <${process.env.ZOHO_SMTP_FROM || process.env.ZOHO_SMTP_USER}>`,
    to: everyone.map((p) => p.email),
    subject: `${approved ? 'Approved' : 'Declined'}: ${requisition.title} (${requester.full_name})`,
    html,
  })
}
