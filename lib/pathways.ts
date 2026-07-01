/**
 * Pathway Configuration for JSS (Grades 7-9)
 * Defines subject categories and point allocations for pathway analysis
 */

export type PathwayName = 'STEM' | 'Social Sciences' | 'Arts & Sports'

export interface PathwayConfig {
  name: PathwayName
  subjects: {
    name: string
    points: number // Out of 8 points for each subject
  }[]
  maxPoints: number // Total points for this pathway (usually 40)
  color: {
    light: string
    main: string
    dark: string
  }
}

export interface PathwayScore {
  name: PathwayName
  score: number
  maxPoints: number
  percentage: number
  subjects: {
    name: string
    marks: number | null
    points: number
    achieved: number
  }[]
}

/**
 * Subject name variations mapping
 * Maps different subject name formats (as schools enter them) to canonical CBC names.
 * Official CBC pathways:
 *   STEM            → Mathematics, Integrated Science, Pre-Technical Studies
 *   Social Sciences → English, Kiswahili, Social Studies
 *   Arts & Sports   → Creative Arts & Sports, Agriculture & Nutrition, Religious Education
 */
const subjectNameVariations: Record<string, string[]> = {
  // STEM subjects
  'Mathematics': [
    'math', 'maths', 'mathematics',
  ],
  'Integrated Science': [
    'integrated science', 'science', 'int science', 'intergrated science',
    'int. science', 'i/science',
  ],
  'Pre-Technical Studies': [
    'pre-technical studies', 'pre-technical', 'pretechnical', 'pre technical',
    'pre technical studies', 'p/tech', 'pre tech', 'pre-tech studies',
  ],
  // Social Sciences subjects
  'English': [
    'english', 'eng',
  ],
  'Kiswahili': [
    'kiswahili', 'k/swahili', 'swahili', 'kiswahli',
  ],
  'Social Studies': [
    'social studies', 'social st', 'ss', 'social study',
  ],
  // Arts & Sports subjects
  'Creative Arts & Sports': [
    'creative arts & sports', 'creative arts and sports', 'creative arts',
    'creative art', 'art', 'arts', 'cas', 'c.a.s',
  ],
  'Agriculture & Nutrition': [
    'agriculture & nutrition', 'agriculture and nutrition', 'agriculture',
    'agric', 'agri', 'agr', 'ag', 'agriculture & nu', 'agr/nu', 'agr/nutrition',
  ],
  'Religious Education': [
    'religious education', 'cre', 'christian religious education', 'c.r.e',
    'ire', 'islamic religious education', 're', 'religion',
  ],
}

/**
 * Normalize subject name to canonical form
 */
function normalizeSubjectName(name: string): string {
  const normalized = name.toLowerCase().trim()
  for (const [canonical, variations] of Object.entries(subjectNameVariations)) {
    if (variations.includes(normalized)) {
      return canonical
    }
  }
  return name
}

/**
 * Pathway definitions for JSS (Grades 7, 8, 9)
 * Based on official CBC pathway criteria:
 *   STEM            → Mathematics (8), Integrated Science (8), Pre-Technical Studies (8)
 *   Social Sciences → English (8), Kiswahili (8), Social Studies (8)
 *   Arts & Sports   → Creative Arts & Sports (8), Agriculture & Nutrition (8), Religious Education (8)
 * Each pathway: 3 subjects × 8 points = 24 max points
 */
export const PATHWAYS: PathwayConfig[] = [
  {
    name: 'STEM',
    subjects: [
      { name: 'Mathematics', points: 8 },
      { name: 'Integrated Science', points: 8 },
      { name: 'Pre-Technical Studies', points: 8 },
    ],
    maxPoints: 24,
    color: {
      light: '#dcfce7',
      main: '#22c55e',
      dark: '#16a34a',
    },
  },
  {
    name: 'Social Sciences',
    subjects: [
      { name: 'English', points: 8 },
      { name: 'Kiswahili', points: 8 },
      { name: 'Social Studies', points: 8 },
    ],
    maxPoints: 24,
    color: {
      light: '#fef3c7',
      main: '#eab308',
      dark: '#ca8a04',
    },
  },
  {
    name: 'Arts & Sports',
    subjects: [
      { name: 'Creative Arts & Sports', points: 8 },
      { name: 'Agriculture & Nutrition', points: 8 },
      { name: 'Religious Education', points: 8 },
    ],
    maxPoints: 24,
    color: {
      light: '#fed7aa',
      main: '#f97316',
      dark: '#ea580c',
    },
  },
]

/**
 * Calculate pathway scores for a learner
 * @param marks - Record of subject IDs to marks
 * @param subjects - Available subjects with their IDs and names
 * @returns Array of pathway scores
 */
export function calculatePathwayScores(
  marks: Record<string, number | null>,
  subjects: Array<{ id: string; name: string }>
): PathwayScore[] {
  // Create a map of normalized subject names to marks
  const subjectMarksByName: Record<string, { id: string; marks: number | null }> = {}
  subjects.forEach(subject => {
    const normalized = normalizeSubjectName(subject.name)
    subjectMarksByName[normalized] = {
      id: subject.id,
      marks: marks[subject.id] ?? null,
    }
  })

  return PATHWAYS.map(pathway => {
    let totalAchieved = 0
    const subjectScores = pathway.subjects.map(pathwaySubject => {
      const normalized = normalizeSubjectName(pathwaySubject.name)
      const subjectData = subjectMarksByName[normalized]
      const marks = subjectData?.marks ?? null

      // Convert marks (0-100) to pathway points (0-8 or 0-6 or 0-4)
      // Assuming marks are out of 100, we convert to the subject's point allocation
      const achieved =
        marks !== null ? Math.round((marks / 100) * pathwaySubject.points) : 0

      totalAchieved += achieved

      return {
        name: pathwaySubject.name,
        marks,
        points: pathwaySubject.points,
        achieved,
      }
    })

    const percentage = (totalAchieved / pathway.maxPoints) * 100

    return {
      name: pathway.name,
      score: totalAchieved,
      maxPoints: pathway.maxPoints,
      percentage,
      subjects: subjectScores,
    }
  })
}

/**
 * Get recommended pathway based on highest score
 */
export function getRecommendedPathway(scores: PathwayScore[]): PathwayName {
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  return sorted[0]?.name || 'STEM'
}

/**
 * Get pathway config by name
 */
export function getPathwayConfig(name: PathwayName): PathwayConfig | undefined {
  return PATHWAYS.find(p => p.name === name)
}
