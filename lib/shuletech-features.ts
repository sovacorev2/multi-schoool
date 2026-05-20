/**
 * ShuleTech pilot features
 * These features are only enabled for ShuleTech school
 * Other schools will continue with original functionality
 */

export const SHULETECH_SCHOOL_NAME = 'ShuleTech'

/**
 * Check if a school is ShuleTech (pilot school for new features)
 */
export function isShuleTechSchool(schoolName?: string): boolean {
  return schoolName?.toLowerCase() === SHULETECH_SCHOOL_NAME.toLowerCase()
}

/**
 * Check if a school is ShuleTech by ID and school data
 */
export function isShuleTechSchoolById(schoolId: string, schools: Array<{ id: string; name: string }>): boolean {
  const school = schools.find(s => s.id === schoolId)
  return isShuleTechSchool(school?.name)
}
