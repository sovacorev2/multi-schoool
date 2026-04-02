// School configuration - uses environment variables for multi-tenancy
// Each school deployment sets these via Vercel environment variables

export const schoolConfig = {
  // School name - displayed throughout the app
  name: process.env.NEXT_PUBLIC_SCHOOL_NAME || 'St. James Koteko Primary School',
  
  // Short name for compact displays
  shortName: process.env.NEXT_PUBLIC_SCHOOL_SHORT_NAME || 'SJKPS',
  
  // Tagline/motto
  tagline: process.env.NEXT_PUBLIC_SCHOOL_TAGLINE || 'Arise and Shine',
  
  // Primary brand color (hex)
  primaryColor: process.env.NEXT_PUBLIC_SCHOOL_PRIMARY_COLOR || '#2563eb',
  
  // Contact info (optional)
  email: process.env.NEXT_PUBLIC_SCHOOL_EMAIL || '',
  phone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || '',
  address: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || '',
  
  // Logo URL (optional - can be uploaded to public folder)
  logoUrl: process.env.NEXT_PUBLIC_SCHOOL_LOGO_URL || '',
  
  // Default teacher password for upper classes (Grade 4+)
  defaultTeacherPassword: process.env.SCHOOL_DEFAULT_PASSWORD || 'welcome',
}

// Default class structure (PP1, PP2, Grade 1-9)
export const DEFAULT_CLASSES = [
  { name: 'PP1', code: 'PP1', order: 1 },
  { name: 'PP2', code: 'PP2', order: 2 },
  { name: 'Grade 1', code: 'GRD1', order: 3 },
  { name: 'Grade 2', code: 'GRD2', order: 4 },
  { name: 'Grade 3', code: 'GRD3', order: 5 },
  { name: 'Grade 4', code: 'GRD4', order: 6 },
  { name: 'Grade 5', code: 'GRD5', order: 7 },
  { name: 'Grade 6', code: 'GRD6', order: 8 },
  { name: 'Grade 7', code: 'GRD7', order: 9 },
  { name: 'Grade 8', code: 'GRD8', order: 10 },
  { name: 'Grade 9', code: 'GRD9', order: 11 },
]

// Default exam types
export const DEFAULT_EXAM_TYPES = [
  { name: 'Opener', description: 'Opening exam at the start of term' },
  { name: 'Midterm', description: 'Mid-term examination' },
  { name: 'Endterm', description: 'End of term examination' },
]

// Classes that require individual passwords (lower grades)
export const LOWER_GRADE_CLASSES = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3']

// Helper to get school display name
export function getSchoolName(): string {
  return schoolConfig.name
}

// Helper for page titles
export function getPageTitle(page: string): string {
  return `${page} | ${schoolConfig.name}`
}

// Check if a class name is a lower grade (needs individual password)
export function isLowerGradeClass(className: string): boolean {
  return LOWER_GRADE_CLASSES.some(grade => className.includes(grade))
}
