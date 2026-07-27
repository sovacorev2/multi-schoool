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
  { level: 'AE2', minMark: 21, maxMark: 30, points: 3 },
  { level: 'BE1', minMark: 11, maxMark: 20, points: 2 },
  { level: 'BE2', minMark: 0, maxMark: 10, points: 1 },
]

// Kolanya Girls custom grading scale for JSS (Grade 7-9)
export const GRADING_SCALE_KOLANYA_GIRLS_JSS: GradeLevel[] = [
  { level: 'EE1', minMark: 88, maxMark: 100, points: 8 },
  { level: 'EE2', minMark: 75, maxMark: 87, points: 7 },
  { level: 'ME1', minMark: 58, maxMark: 74, points: 6 },
  { level: 'ME2', minMark: 41, maxMark: 57, points: 5 },
  { level: 'AE1', minMark: 31, maxMark: 40, points: 4 },
  { level: 'AE2', minMark: 21, maxMark: 30, points: 3 },
  { level: 'BE1', minMark: 11, maxMark: 20, points: 2 },
  { level: 'BE2', minMark: 0, maxMark: 10, points: 1 },
]

// Kolanya Girls custom grading scale for Primary (Grades 1-6) - 4 levels only
export const GRADING_SCALE_KOLANYA_GIRLS_PRIMARY: GradeLevel[] = [
  { level: 'EE', minMark: 75, maxMark: 100, points: 4 },
  { level: 'ME', minMark: 50, maxMark: 74, points: 3 },
  { level: 'AE', minMark: 25, maxMark: 49, points: 2 },
  { level: 'BE', minMark: 0, maxMark: 24, points: 1 },
]

// Kolanya Girls custom grading scale (legacy - kept for compatibility)
export const GRADING_SCALE_KOLANYA_GIRLS: GradeLevel[] = GRADING_SCALE_KOLANYA_GIRLS_JSS

// Simple grading scale for lower classes (PP1, PP2, Grade 1-6) - 8 levels with 0.5 increments
export const GRADING_SCALE_SIMPLE: GradeLevel[] = [
  { level: 'EE1', minMark: 90, maxMark: 100, points: 4.0 },
  { level: 'EE2', minMark: 75, maxMark: 89, points: 3.5 },
  { level: 'ME1', minMark: 58, maxMark: 74, points: 3.0 },
  { level: 'ME2', minMark: 41, maxMark: 57, points: 2.5 },
  { level: 'AE1', minMark: 31, maxMark: 40, points: 2.0 },
  { level: 'AE2', minMark: 21, maxMark: 30, points: 1.5 },
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
// Upper classes are Grade/Form 7-9, or any class containing secondary/upper class numbers
export function isUpperClass(className: string): boolean {
  if (!className) return false
  // Check explicit patterns first
  const upperClassPatterns = ['Grade 7', 'Grade 8', 'Grade 9', 'GRD7', 'GRD8', 'GRD9', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'JSS', 'Class 7', 'Class 8', 'Class 9', 'Form 5', 'Form 6']
  if (upperClassPatterns.some(grade => className.includes(grade))) return true
  
  // Also check for patterns like "STD 7", "P7", "S3" or anything ending in 7,8,9 after a word
  return /\b(STD|P|S|Form|Grade|Class|GRD|JSS)[\s\-]*[7-9]\b/i.test(className)
}

// Get the appropriate grading scale based on school and class
export function getGradingScale(className?: string, schoolName?: string): GradeLevel[] {
  // Check if this is Kolanya Girls school
  if (schoolName && schoolName.toLowerCase().includes('kolanya')) {
    // If it's Kolanya Girls, determine if it's primary or secondary
    if (!className) return GRADING_SCALE_KOLANYA_GIRLS_JSS
    
    const isUpper = isUpperClass(className)
    return isUpper ? GRADING_SCALE_KOLANYA_GIRLS_JSS : GRADING_SCALE_KOLANYA_GIRLS_PRIMARY
  }
  
  // Kimaeti and other schools use the default extended/simple scales
  // (Kimaeti uses same scale as Amagoro)
  if (!className) return GRADING_SCALE_EXTENDED
  const isUpper = isUpperClass(className)
  return isUpper ? GRADING_SCALE_EXTENDED : GRADING_SCALE_SIMPLE
}

// Overall performance level based on TOTAL MARKS across all subjects.
// These fixed bands apply school-wide regardless of class or school:
//   0–98   → BE2   (points 1)
//   99–188  → BE1   (points 2)
//   189–278 → AE2   (points 3)
//   279–368 → AE1   (points 4)
//   369–521 → ME2   (points 5)
//   522–674 → ME1   (points 6)
//   675–809 → EE2   (points 7)
//   810–900 → EE1   (points 8)
export const OVERALL_TOTAL_MARKS_SCALE = [
  { level: 'EE1', minTotal: 810, maxTotal: Infinity, points: 8 },
  { level: 'EE2', minTotal: 675, maxTotal: 809,      points: 7 },
  { level: 'ME1', minTotal: 522, maxTotal: 674,      points: 6 },
  { level: 'ME2', minTotal: 369, maxTotal: 521,      points: 5 },
  { level: 'AE1', minTotal: 279, maxTotal: 368,      points: 4 },
  { level: 'AE2', minTotal: 189, maxTotal: 278,      points: 3 },
  { level: 'BE1', minTotal:  99, maxTotal: 188,      points: 2 },
  { level: 'BE2', minTotal:   0, maxTotal:  98,      points: 1 },
]

export function getLevelByTotalMarksRange(
  totalMarks: number | null | undefined
): { level: string; points: number } | null {
  if (totalMarks === null || totalMarks === undefined || isNaN(Number(totalMarks))) return null
  const t = Number(totalMarks)
  const band = OVERALL_TOTAL_MARKS_SCALE.find(b => t >= b.minTotal && t <= b.maxTotal)
  return band ? { level: band.level, points: band.points } : null
}

/**
 * Get overall performance level from a raw total, accounting for the actual
 * number of subjects the school has configured.
 *
 * This replaces `getLevelByTotalMarksRange` which used hardcoded absolute bands
 * built for exactly 9 subjects (max 900). Schools with fewer subjects (e.g. 6)
 * had their totals fall into wrong bands because 540/600 (90%) was compared
 * against a 900-point scale.
 *
 * The fix: divide total by subjectCount to get the average mark (0-100), then
 * use the same per-subject grading scale — identical logic to how individual
 * subject grades are calculated.
 */
export function getLevelByTotal(
  totalMarks: number | null | undefined,
  subjectCount: number,
  className?: string,
  schoolName?: string
): { level: string; points: number } | null {
  if (totalMarks === null || totalMarks === undefined || isNaN(Number(totalMarks))) return null
  if (!subjectCount || subjectCount <= 0) return null
  return getLevelByAverageMark(Number(totalMarks), subjectCount, className, schoolName)
}

// Derive the overall performance level from the average RAW MARK (total marks / subjects).
// Kept for backward compatibility — prefer getLevelByTotalMarksRange for overall level.
export function getLevelByAverageMark(
  totalMarks: number,
  subjectCount: number,
  className?: string,
  schoolName?: string
): { level: string; points: number } | null {
  if (!subjectCount || subjectCount === 0) return null
  const avgMark = totalMarks / subjectCount
  return getGradeLevelByClass(avgMark, className, schoolName)
}

// Derive the overall performance level from total points and number of subjects.
// DEPRECATED: use getLevelByAverageMark instead — this function derives levels from
// rubric-point averages which can produce inconsistent results when mark totals differ.
// Kept for backward compatibility only.
export function getLevelByTotalPoints(
  totalPoints: number,
  subjectCount: number,
  className?: string,
  schoolName?: string
): { level: string; points: number } | null {
  if (!subjectCount || subjectCount === 0) return null
  const avgPoints = totalPoints / subjectCount
  const scale = getGradingScale(className, schoolName)
  let best: GradeLevel | null = null
  let bestDiff = Infinity
  for (const g of scale) {
    const diff = Math.abs(g.points - avgPoints)
    if (diff < bestDiff) {
      bestDiff = diff
      best = g
    }
  }
  return best ? { level: best.level, points: best.points } : null
}

// Get grade level with class and school context
export function getGradeLevelByClass(marks: number | string | null | undefined, className?: string, schoolName?: string): { level: string; points: number } | null {
  if (marks === null || marks === undefined) return null

  // Coerce to a number defensively — DB numeric columns can arrive as strings,
  // and string comparisons would break the min/max range matching.
  const score = typeof marks === 'string' ? parseFloat(marks) : marks
  if (typeof score !== 'number' || Number.isNaN(score)) return null

  const scale = getGradingScale(className, schoolName)
  const grade = scale.find(g => score >= g.minMark && score <= g.maxMark)
  return grade ? { level: grade.level, points: grade.points } : null
}
