// Grading scale based on marks scored
export interface GradeLevel {
  level: string
  minMark: number
  maxMark: number
  points: number
}

// Extended grading scale for upper classes (Grade 7-9) - 8 levels with 1-8 points
export const GRADING_SCALE_EXTENDED: GradeLevel[] = [
  { level: 'EE1', minMark: 90, maxMark: 100, points: 8 },
  { level: 'EE2', minMark: 75, maxMark: 89, points: 7 },
  { level: 'ME1', minMark: 58, maxMark: 74, points: 6 },
  { level: 'ME2', minMark: 41, maxMark: 57, points: 5 },
  { level: 'AE1', minMark: 31, maxMark: 40, points: 4 },
  { level: 'AE3', minMark: 21, maxMark: 30, points: 3 },
  { level: 'BE1', minMark: 11, maxMark: 20, points: 2 },
  { level: 'BE2', minMark: 0, maxMark: 10, points: 1 },
]

// Kolanya Girls custom grading scale
export const GRADING_SCALE_KOLANYA_GIRLS: GradeLevel[] = [
  { level: 'EE1', minMark: 88, maxMark: 100, points: 8 },
  { level: 'EE2', minMark: 75, maxMark: 87, points: 7 },
  { level: 'ME1', minMark: 58, maxMark: 74, points: 6 },
  { level: 'ME2', minMark: 41, maxMark: 57, points: 5 },
  { level: 'AE1', minMark: 31, maxMark: 40, points: 4 },
  { level: 'AE2', minMark: 21, maxMark: 30, points: 3 },
  { level: 'P.E1', minMark: 11, maxMark: 20, points: 2 },
  { level: 'BE2', minMark: 0, maxMark: 10, points: 1 },
]

// Simple grading scale for lower classes (PP1, PP2, Grade 1-6) - 8 levels with 0.5 increments
export const GRADING_SCALE_SIMPLE: GradeLevel[] = [
  { level: 'EE1', minMark: 90, maxMark: 100, points: 4.0 },
  { level: 'EE2', minMark: 75, maxMark: 89, points: 3.5 },
  { level: 'ME1', minMark: 58, maxMark: 74, points: 3.0 },
  { level: 'ME2', minMark: 41, maxMark: 57, points: 2.5 },
  { level: 'AE1', minMark: 31, maxMark: 40, points: 2.0 },
  { level: 'AE3', minMark: 21, maxMark: 30, points: 1.5 },
  { level: 'BE1', minMark: 11, maxMark: 20, points: 1.0 },
  { level: 'BE2', minMark: 0, maxMark: 10, points: 0.5 },
]

// Default grading scale (extended for compatibility)
export const GRADING_SCALE: GradeLevel[] = GRADING_SCALE_EXTENDED

export function getGradeLevel(marks: number | null | undefined): { level: string; points: number } | null {
  if (marks === null || marks === undefined) return null
  
  const grade = GRADING_SCALE.find(g => marks >= g.minMark && marks <= g.maxMark)
  return grade ? { level: grade.level, points: grade.points } : null
}

export function formatGradeWithPoints(marks: number | null | undefined): string {
  const grade = getGradeLevel(marks)
  return grade ? `${grade.level} (${grade.points})` : '-'
}

export function getPerformanceLevelWithPoints(marks: number | null | undefined): { level: string; points: number } | null {
  if (marks === null || marks === undefined) return null
  
  const grade = GRADING_SCALE.find(g => marks >= g.minMark && marks <= g.maxMark)
  return grade ? { level: grade.level, points: grade.points } : null
}

// Helper to determine if a class uses extended grading (upper classes)
export function isUpperClass(className: string): boolean {
  if (!className) return false
  const upperClassPatterns = ['Grade 7', 'Grade 8', 'Grade 9', 'GRD7', 'GRD8', 'GRD9', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'JSS', 'Class 7', 'Class 8', 'Class 9']
  return upperClassPatterns.some(grade => className.includes(grade))
}

// Get the appropriate grading scale based on school and class
export function getGradingScale(className?: string, schoolName?: string): GradeLevel[] {
  // Check if this is Kolanya Girls school
  if (schoolName && schoolName.toLowerCase().includes('kolanya')) {
    console.log('[v0] Using Kolanya Girls custom grading scale')
    return GRADING_SCALE_KOLANYA_GIRLS
  }
  
  if (!className) return GRADING_SCALE_EXTENDED
  const isUpper = isUpperClass(className)
  console.log('[v0] Class:', className, 'School:', schoolName, 'isUpperClass:', isUpper, 'Scale:', isUpper ? 'EXTENDED (1-8)' : 'SIMPLE (0.5 increments)')
  return isUpper ? GRADING_SCALE_EXTENDED : GRADING_SCALE_SIMPLE
}

// Get grade level with class and school context
export function getGradeLevelByClass(marks: number | null | undefined, className?: string, schoolName?: string): { level: string; points: number } | null {
  if (marks === null || marks === undefined) return null
  
  const scale = getGradingScale(className, schoolName)
  const grade = scale.find(g => marks >= g.minMark && marks <= g.maxMark)
  return grade ? { level: grade.level, points: grade.points } : null
}
