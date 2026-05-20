/**
 * Pilot Features System - Toggleable for Any School
 * 
 * Features are enabled when:
 * 1. School name is in PILOT_SCHOOLS (legacy hardcoded)
 * 2. School has feature_pin_management = true (modern per-school toggle)
 * 
 * All pilot features are controlled by this single flag:
 * - PIN authentication (admin portal)
 * - Subject-level access control
 * - Teachers & Assignments management
 * - Advanced audit logging
 * - Modern UI components
 */

export const PILOT_SCHOOLS = ['SHULE TECH', 'ST JAMES KOTEKO PRIMARY SCHOOL']

/**
 * Check if a school has pilot features enabled
 * Supports both legacy hardcoded list and modern feature flag
 */
export function isShuleTechSchool(schoolNameOrData?: string | { name?: string; feature_pin_management?: boolean }): boolean {
  if (!schoolNameOrData) {
    return false
  }

  // If passed an object with feature_pin_management, check that first (modern approach)
  if (typeof schoolNameOrData === 'object' && schoolNameOrData !== null) {
    // Explicitly check for true, in case column doesn't exist (undefined) or is false
    if ('feature_pin_management' in schoolNameOrData && schoolNameOrData.feature_pin_management === true) {
      return true
    }
    // Fall back to checking name
    const name = schoolNameOrData.name
    if (name) {
      const normalized = name.toLowerCase().trim()
      return PILOT_SCHOOLS.some(school => normalized === school.toLowerCase())
    }
    return false
  }

  // String check (legacy)
  if (typeof schoolNameOrData === 'string') {
    const normalized = schoolNameOrData.toLowerCase().trim()
    return PILOT_SCHOOLS.some(school => normalized === school.toLowerCase())
  }

  return false
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
 * Modern way to check if pilot features should be active
 */
export function isPilotFeaturesEnabled(school?: { feature_pin_management?: boolean; name?: string }): boolean {
  if (!school) {
    return false
  }
  return isShuleTechSchool(school)
}
