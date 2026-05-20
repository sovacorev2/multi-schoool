/**
 * Pilot school features
 * These features are enabled for pilot schools (ShuleTech + St James Koteko Primary)
 * Other schools will continue with original functionality
 */

export const PILOT_SCHOOLS = ['SHULE TECH', 'ST JAMES KOTEKO PRIMARY SCHOOL']

/**
 * Check if a school is a pilot school (ShuleTech or St James Koteko Primary)
 * Pilot schools get all advanced features: modern UI, PIN tracking, advanced audit logs
 */
export function isShuleTechSchool(schoolName?: string): boolean {
  if (!schoolName) {
    return false
  }
  
  const normalized = schoolName.toLowerCase().trim()
  return PILOT_SCHOOLS.some(school => normalized === school.toLowerCase())
}

/**
 * Feature flags interface for per-school settings
 */
export interface SchoolFeatures {
  feature_report_cards: boolean
  feature_whatsapp_reports: boolean
  feature_sms: boolean
  feature_bulk_sms: boolean
  feature_certificates: boolean
  feature_pin_management: boolean
}

/**
 * Check if PIN management feature is enabled for a school
 * Can be enabled via super admin settings or for pilot schools
 */
export function isPinManagementEnabled(schoolName: string, features: SchoolFeatures | undefined): boolean {
  if (!features) {
    return isShuleTechSchool(schoolName) // Default to enabled for pilot schools
  }
  return features.feature_pin_management === true
}
