// Normalize subject names to handle variations (Math, Mathematics, Maths, etc.)
export function normalizeSubjectName(subjectName: string): string {
  if (!subjectName) return ''
  
  const normalized = subjectName.trim().toUpperCase()
  
  // Subject name mappings for common variations
  const subjectMappings: Record<string, string> = {
    'MATH': 'MATHEMATICS',
    'MATHS': 'MATHEMATICS',
    'MATHEMATICS': 'MATHEMATICS',
    'ENGLISH': 'ENGLISH',
    'ENG': 'ENGLISH',
    'ENGLISH LANGUAGE': 'ENGLISH',
    'KISWAHILI': 'KISWAHILI',
    'SWAHILI': 'KISWAHILI',
    'KISW': 'KISWAHILI',
    'SCIENCE': 'SCIENCE',
    'INTEGRATED SCIENCE': 'SCIENCE',
    'SOCIAL STUDIES': 'SOCIAL STUDIES',
    'SS': 'SOCIAL STUDIES',
    'CHRISTIAN RELIGIOUS EDUCATION': 'CRE',
    'CHRISTIAN REL EDUCATION': 'CRE',
    'CHRISTIAN RELIGION': 'CRE',
    'CRE': 'CRE',
    'REL EDUCATION': 'CRE',
    'ISLAMIC RELIGIOUS EDUCATION': 'IRE',
    'ISLAMIC RELIGION': 'IRE',
    'IRE': 'IRE',
    'PHYSICAL EDUCATION': 'PE',
    'PE': 'PE',
    'PHY ED': 'PE',
    'PHYSICAL ED': 'PE',
    'AGRICULTURE': 'AGRICULTURE',
    'AGRI': 'AGRICULTURE',
    'AGR': 'AGRICULTURE',
    'COMPUTER STUDIES': 'COMPUTER STUDIES',
    'COMPUTERS': 'COMPUTER STUDIES',
    'ICT': 'ICT',
    'INFORMATION TECHNOLOGY': 'ICT',
    'INFORMATION & COMMUNICATION TECHNOLOGY': 'ICT',
    'ART': 'ART',
    'VISUAL ARTS': 'ART',
    'MUSIC': 'MUSIC',
    'HOME SCIENCE': 'HOME SCIENCE',
    'HOME EC': 'HOME SCIENCE',
    'HOME ECONOMICS': 'HOME SCIENCE',
    'ENTREPRENEURSHIP': 'ENTREPRENEURSHIP',
    'BUSINESS STUDIES': 'BUSINESS STUDIES',
    'BUSINESS': 'BUSINESS STUDIES',
    'HISTORY': 'HISTORY',
    'GEOGRAPHY': 'GEOGRAPHY',
    'GEOMETRY': 'GEOMETRY',
    'ENVIRONMENTAL STUDIES': 'ENVIRONMENTAL STUDIES',
    'ENVIRONMENTAL': 'ENVIRONMENTAL STUDIES',
    'LITERACY': 'LITERACY',
    'NUMERACY': 'NUMERACY',
    'PRE TECHNICAL': 'PRE-TECHNICAL',
    'PRETECHNICAL': 'PRE-TECHNICAL',
    'PRE-TECHNICAL': 'PRE-TECHNICAL',
  }
  
  // Check if the normalized subject exists in mappings
  if (subjectMappings[normalized]) {
    return subjectMappings[normalized]
  }
  
  // For subjects not in the mapping, check for partial matches
  for (const [key, value] of Object.entries(subjectMappings)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value
    }
  }
  
  return normalized
}

// Utility function to get abbreviated subject name for long subjects
export function getSubjectDisplay(subjectName: string): string {
  const name = subjectName?.trim().toUpperCase() || ''

  // Abbreviations for specific long subjects
  const abbreviations: Record<string, string> = {
    'CHRISTIAN RELIGIOUS EDUCATION': 'CRE',
    'CHRISTIAN REL EDUCATION': 'CRE',
    'CHRISTIAN RELIGION': 'CRE',
    'PRE TECHNICAL': 'PRETECH',
    'PRETECHNICAL': 'PRETECH',
    'PRE-TECHNICAL': 'PRETECH'
  }

  // Only abbreviate when the subject's name contains the full long name.
  // This used to also match the other way round (long name contains the
  // subject's name), so a plain "RELIGIOUS EDUCATION" (Muslim schools such
  // as Malakisi) was printed as "CRE" on report cards and marklists because
  // "CHRISTIAN RELIGIOUS EDUCATION" contains it. A bare "REL EDUCATION" is
  // generic too, so it is no longer forced to CRE either.
  for (const [fullName, abbr] of Object.entries(abbreviations)) {
    if (name.includes(fullName)) {
      return abbr
    }
  }

  // Return full name for all other subjects
  return subjectName
}

// Compare two subject names accounting for variations
export function areSubjectsEqual(subject1: string, subject2: string): boolean {
  return normalizeSubjectName(subject1) === normalizeSubjectName(subject2)
}
