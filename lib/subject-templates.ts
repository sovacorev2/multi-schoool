// Standardized subject templates by grade level to prevent duplicate naming chaos
// Each subject has a unique code (used in marksheets as column headers)

export type SubjectLevel = 'grade-1-3' | 'grade-4-6' | 'jss'

export interface SubjectTemplate {
  name: string
  code: string
  level: SubjectLevel
  isVariant?: boolean // For SST/SSRE variants
}

export const SUBJECT_TEMPLATES: SubjectTemplate[] = [
  // Grade 1-3 (Primary Lower) - Kenyan CBC Curriculum
  {
    name: 'English Language Activities',
    code: 'ENG',
    level: 'grade-1-3',
  },
  {
    name: 'Kiswahili Language Activities',
    code: 'KIS',
    level: 'grade-1-3',
  },
  {
    name: 'Mathematics Activities',
    code: 'MAT',
    level: 'grade-1-3',
  },
  {
    name: 'Environmental Activities',
    code: 'ENV',
    level: 'grade-1-3',
  },
  {
    name: 'Creative Activities',
    code: 'CAS',
    level: 'grade-1-3',
  },
  {
    name: 'Christian Religious Education Activities',
    code: 'CRE',
    level: 'grade-1-3',
  },
  {
    name: 'Islamic Religious Education Activities',
    code: 'IRE',
    level: 'grade-1-3',
  },
  {
    name: 'Hindu Religious Education Activities',
    code: 'HRE',
    level: 'grade-1-3',
  },

  // Grade 4-6 (Primary Upper) - Kenyan CBC Curriculum
  {
    name: 'English',
    code: 'ENG',
    level: 'grade-4-6',
  },
  {
    name: 'Kiswahili',
    code: 'KIS',
    level: 'grade-4-6',
  },
  {
    name: 'Mathematics',
    code: 'MAT',
    level: 'grade-4-6',
  },
  {
    name: 'Science and Technology',
    code: 'SCI/TECH',
    level: 'grade-4-6',
  },
  {
    name: 'Social Studies',
    code: 'SST',
    level: 'grade-4-6',
  },
  {
    name: 'Social Studies + Religious Education (Combined)',
    code: 'SSRE',
    level: 'grade-4-6',
    isVariant: true, // Schools choose between SST or SSRE
  },
  {
    name: 'Christian Religious Education',
    code: 'CRE',
    level: 'grade-4-6',
  },
  {
    name: 'Islamic Religious Education',
    code: 'IRE',
    level: 'grade-4-6',
  },
  {
    name: 'Hindu Religious Education',
    code: 'HRE',
    level: 'grade-4-6',
  },
  {
    name: 'Creative Arts',
    code: 'CAS',
    level: 'grade-4-6',
  },
  {
    name: 'Agriculture and Nutrition',
    code: 'AGRI/NUT',
    level: 'grade-4-6',
  },
  {
    name: 'Life Skills',
    code: 'LIFE',
    level: 'grade-4-6',
  },

  // JSS (Form 1-3) - Kenyan CBC/KCSE Curriculum
  {
    name: 'English',
    code: 'ENG',
    level: 'jss',
  },
  {
    name: 'Kiswahili',
    code: 'KIS',
    level: 'jss',
  },
  {
    name: 'Mathematics',
    code: 'MAT',
    level: 'jss',
  },
  {
    name: 'Integrated Science',
    code: 'INT/SCIENCE',
    level: 'jss',
  },
  {
    name: 'Social Studies',
    code: 'SST',
    level: 'jss',
  },
  {
    name: 'Social Studies + Religious Education (Combined)',
    code: 'SSRE',
    level: 'jss',
    isVariant: true, // Schools choose between SST or SSRE
  },
  {
    name: 'Christian Religious Education',
    code: 'CRE',
    level: 'jss',
  },
  {
    name: 'Islamic Religious Education',
    code: 'IRE',
    level: 'jss',
  },
  {
    name: 'Hindu Religious Education',
    code: 'HRE',
    level: 'jss',
  },
  {
    name: 'Creative Arts',
    code: 'CAS',
    level: 'jss',
  },
  {
    name: 'Agriculture',
    code: 'AGRI',
    level: 'jss',
  },
  {
    name: 'Pre-Technical Studies',
    code: 'PRE-TECH',
    level: 'jss',
  },
  {
    name: 'Home Science',
    code: 'HOME',
    level: 'jss',
  },
  {
    name: 'Business Studies',
    code: 'BUS',
    level: 'jss',
  },
  {
    name: 'Computer Studies',
    code: 'COMP',
    level: 'jss',
  },
]

// Get templates for a specific level
export function getTemplatesForLevel(level: SubjectLevel): SubjectTemplate[] {
  return SUBJECT_TEMPLATES.filter(s => s.level === level)
}

// Get unique codes for a level (for validation)
export function getCodesForLevel(level: SubjectLevel): string[] {
  return getTemplatesForLevel(level).map(s => s.code)
}

// Detect school level from existing classes
export function inferSchoolLevel(classNames: string[]): SubjectLevel {
  const names = classNames.map(n => n.toUpperCase())
  
  // Check for JSS/Form indicators
  if (names.some(n => n.includes('FORM') || n.includes('JSS'))) {
    return 'jss'
  }
  
  // Check for Grade 4-6 indicators
  if (names.some(n => {
    const match = n.match(/GRADE\s*([0-9]+)/)
    return match && parseInt(match[1]) >= 4
  })) {
    return 'grade-4-6'
  }
  
  // Check for Grade 1-3 indicators
  if (names.some(n => {
    const match = n.match(/GRADE\s*([0-9]+)|PP\d+/)
    return match && (parseInt(match[1]) <= 3 || n.includes('PP'))
  })) {
    return 'grade-1-3'
  }
  
  // Default to grade-1-3 for unknown
  return 'grade-1-3'
}
