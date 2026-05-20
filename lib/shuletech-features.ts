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
  if (!schoolName) {
    console.log('[v0] isShuleTechSchool: schoolName is empty/null')
    return false
  }
  
  const normalized = schoolName.toLowerCase().trim()
  const isMatch = normalized === SHULETECH_SCHOOL_NAME.toLowerCase()
  
  console.log('[v0] isShuleTechSchool check:', { 
    input: schoolName, 
    normalized, 
    expected: SHULETECH_SCHOOL_NAME.toLowerCase(),
    isMatch 
  })
  
  return isMatch
}

/**
 * Check if a school is ShuleTech by ID and school data
 */
export function isShuleTechSchoolById(schoolId: string, schools: Array<{ id: string; name: string }>): boolean {
  const school = schools.find(s => s.id === schoolId)
  return isShuleTechSchool(school?.name)
}
