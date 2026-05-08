// All Kenyan CBC subjects (PP1-Grade 9) available globally
// Admin toggles what school does, teachers select for their class
// Each subject has a unique code (used in marksheets as column headers)

export type SubjectLevel = 'all'

export interface SubjectTemplate {
  name: string
  code: string
  level: SubjectLevel
  isVariant?: boolean // For SST/SSRE variants
}

export const SUBJECT_TEMPLATES: SubjectTemplate[] = [
  // PP1-Grade 3 (Primary Lower) - Kenyan CBC Curriculum
  { name: 'English Language Activities', code: 'ENG', level: 'all' },
  { name: 'Kiswahili Language Activities', code: 'KIS', level: 'all' },
  { name: 'Mathematics Activities', code: 'MAT', level: 'all' },
  { name: 'Environmental Activities', code: 'ENV', level: 'all' },
  { name: 'Creative Activities', code: 'CAS', level: 'all' },
  { name: 'Christian Religious Education Activities', code: 'CRE', level: 'all' },
  { name: 'Islamic Religious Education Activities', code: 'IRE', level: 'all' },
  { name: 'Hindu Religious Education Activities', code: 'HRE', level: 'all' },

  // Grade 4-6 (Primary Upper) - Kenyan CBC Curriculum
  { name: 'English', code: 'ENG', level: 'all' },
  { name: 'Kiswahili', code: 'KIS', level: 'all' },
  { name: 'Mathematics', code: 'MAT', level: 'all' },
  { name: 'Science and Technology', code: 'SCI/TECH', level: 'all' },
  { name: 'Social Studies', code: 'SST', level: 'all' },
  { name: 'Social Studies + Religious Education (Combined)', code: 'SSRE', level: 'all', isVariant: true },
  { name: 'Christian Religious Education', code: 'CRE', level: 'all' },
  { name: 'Islamic Religious Education', code: 'IRE', level: 'all' },
  { name: 'Hindu Religious Education', code: 'HRE', level: 'all' },
  { name: 'Creative Arts', code: 'CAS', level: 'all' },
  { name: 'Agriculture and Nutrition', code: 'AGRI/NUT', level: 'all' },
  { name: 'Life Skills', code: 'LIFE', level: 'all' },

  // Grade 7-9 (Secondary/JSS) - Kenyan CBC/KCSE Curriculum
  { name: 'English', code: 'ENG', level: 'all' },
  { name: 'Kiswahili', code: 'KIS', level: 'all' },
  { name: 'Mathematics', code: 'MAT', level: 'all' },
  { name: 'Integrated Science', code: 'INT/SCIENCE', level: 'all' },
  { name: 'Social Studies', code: 'SST', level: 'all' },
  { name: 'Social Studies + Religious Education (Combined)', code: 'SSRE', level: 'all', isVariant: true },
  { name: 'Christian Religious Education', code: 'CRE', level: 'all' },
  { name: 'Islamic Religious Education', code: 'IRE', level: 'all' },
  { name: 'Hindu Religious Education', code: 'HRE', level: 'all' },
  { name: 'Creative Arts', code: 'CAS', level: 'all' },
  { name: 'Agriculture', code: 'AGRI', level: 'all' },
  { name: 'Pre-Technical Studies', code: 'PRE-TECH', level: 'all' },
  { name: 'Home Science', code: 'HOME', level: 'all' },
  { name: 'Business Studies', code: 'BUS', level: 'all' },
  { name: 'Computer Studies', code: 'COMP', level: 'all' },
]

// Get all templates (all subjects available globally)
export function getTemplatesForLevel(level: SubjectLevel): SubjectTemplate[] {
  return SUBJECT_TEMPLATES
}
