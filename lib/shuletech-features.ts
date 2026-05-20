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
