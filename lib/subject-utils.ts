// Utility function to get abbreviated subject name for long subjects
export function getSubjectDisplay(subjectName: string): string {
  const name = subjectName?.trim().toUpperCase() || ''

  // Abbreviations for specific long subjects
  const abbreviations: Record<string, string> = {
    'CHRISTIAN RELIGIOUS EDUCATION': 'CRE',
    'CHRISTIAN REL EDUCATION': 'CRE',
    'CHRISTIAN RELIGION': 'CRE',
    'REL EDUCATION': 'CRE',
    'PRE TECHNICAL': 'PRETECH',
    'PRETECHNICAL': 'PRETECH',
    'PRE-TECHNICAL': 'PRETECH'
  }

  // Check if subject matches any abbreviation pattern
  for (const [fullName, abbr] of Object.entries(abbreviations)) {
    if (name.includes(fullName) || fullName.includes(name)) {
      return abbr
    }
  }

  // Return full name for all other subjects
  return subjectName
}
