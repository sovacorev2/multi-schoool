export interface School {
  id: string
  name: string
  short_name: string
  code: string
  tagline: string
  email: string
  phone: string
  address: string
  logo_url?: string | null
  primary_color: string
  admin_password: string
  is_active: boolean
  feature_report_cards?: boolean
  feature_whatsapp_reports?: boolean
  feature_bulk_sms?: boolean
  feature_certificates?: boolean
  feature_pin_management?: boolean
  subscription_plan?: string | null
  subscription_expires_at?: string | null
  enable_pin_login?: boolean
  pin_login_enabled_at?: string | null
}

export interface AuditLog {
  id: string
  action: string
  details: string
  user_type?: string
  teacher_pin?: string
  created_at: string
}

export interface Deadline {
  id: string
  class_id: string
  term: string
  year: number
  deadline_date: string
  is_locked: boolean
  class_name?: string
  exam_type?: string
}

// The full school record fetched at auth time (and re-fetched on save) — every
// admin-portal page/section that needs school fields reads it from AdminSchoolContext
// instead of re-querying, so Settings' edits are immediately visible everywhere.
export const SCHOOL_SELECT_FIELDS =
  'id, name, short_name, code, tagline, email, phone, address, logo_url, primary_color, admin_password, is_active, feature_report_cards, feature_whatsapp_reports, feature_bulk_sms, feature_certificates, feature_pin_management, subscription_plan, subscription_expires_at, enable_pin_login, pin_login_enabled_at'
