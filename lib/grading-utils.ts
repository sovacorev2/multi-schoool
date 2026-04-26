// Grading scale based on marks scored
export interface GradeLevel {
  level: string
  minMark: number
  maxMark: number
  points: number
}

export const GRADING_SCALE: GradeLevel[] = [
  { level: 'EE1', minMark: 90, maxMark: 99, points: 4.0 },
  { level: 'EE2', minMark: 75, maxMark: 89, points: 3.5 },
  { level: 'ME1', minMark: 58, maxMark: 74, points: 3.0 },
  { level: 'ME2', minMark: 41, maxMark: 57, points: 2.5 },
  { level: 'AE1', minMark: 31, maxMark: 40, points: 2.0 },
  { level: 'AE3', minMark: 21, maxMark: 30, points: 1.5 },
  { level: 'BE1', minMark: 11, maxMark: 20, points: 1.0 },
  { level: 'BE2', minMark: 1, maxMark: 10, points: 0.5 },
]

export function getGradeLevel(marks: number | null | undefined): { level: string; points: number } | null {
  if (marks === null || marks === undefined) return null
  
  const grade = GRADING_SCALE.find(g => marks >= g.minMark && marks <= g.maxMark)
  return grade ? { level: grade.level, points: grade.points } : null
}

export function formatGradeWithPoints(marks: number | null | undefined): string {
  const grade = getGradeLevel(marks)
  return grade ? `${grade.level} (${grade.points})` : '-'
}
