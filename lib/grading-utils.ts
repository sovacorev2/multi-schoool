// Grading scale based on marks scored
export interface GradeLevel {
  level: string
  minMark: number
  maxMark: number
  points: number
}

// Extended grading scale for upper classes (Grade 7-9) - 8 levels
export const GRADING_SCALE_EXTENDED: GradeLevel[] = [
  { level: 'EE1', minMark: 90, maxMark: 99, points: 4.0 },
  { level: 'EE2', minMark: 75, maxMark: 89, points: 3.5 },
  { level: 'ME1', minMark: 58, maxMark: 74, points: 3.0 },
  { level: 'ME2', minMark: 41, maxMark: 57, points: 2.5 },
  { level: 'AE1', minMark: 31, maxMark: 40, points: 2.0 },
  { level: 'AE3', minMark: 21, maxMark: 30, points: 1.5 },
  { level: 'BE1', minMark: 11, maxMark: 20, points: 1.0 },
  { level: 'BE2', minMark: 1, maxMark: 10, points: 0.5 },
]

// Simple grading scale for lower classes (PP1, PP2, Grade 1-6) - 4 levels
export const GRADING_SCALE_SIMPLE: GradeLevel[] = [
  { level: 'EE', minMark: 75, maxMark: 100, points: 4.0 },
  { level: 'ME', minMark: 50, maxMark: 74, points: 2.5 },
  { level: 'AE', minMark: 25, maxMark: 49, points: 2.0 },
  { level: 'BE', minMark: 0, maxMark: 24, points: 1.0 },
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
  return ['Grade 7', 'Grade 8', 'Grade 9', 'GRD7', 'GRD8', 'GRD9'].some(grade => 
    className.includes(grade)
  )
}

// Get the appropriate grading scale based on class
export function getGradingScale(className?: string): GradeLevel[] {
  if (!className) return GRADING_SCALE_EXTENDED
  return isUpperClass(className) ? GRADING_SCALE_EXTENDED : GRADING_SCALE_SIMPLE
}

// Get grade level with class context
export function getGradeLevelByClass(marks: number | null | undefined, className?: string): { level: string; points: number } | null {
  if (marks === null || marks === undefined) return null
  
  const scale = getGradingScale(className)
  const grade = scale.find(g => marks >= g.minMark && marks <= g.maxMark)
  return grade ? { level: grade.level, points: grade.points } : null
}
