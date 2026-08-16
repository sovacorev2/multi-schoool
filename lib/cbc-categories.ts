// Single source of truth for the four CBC level categories, matching the
// classification already used (inline, duplicated) in the School Analysis
// report at app/dashboard/marklist/page.tsx - kept identical so a class maps
// to the same category everywhere in the app.

export interface CbcCategory {
  name: string
  classNames: string[]
}

export const CBC_CATEGORIES: CbcCategory[] = [
  { name: 'Pre-School', classNames: ['Playgroup', 'PP1', 'PP2'] },
  { name: 'Lower Primary', classNames: ['Grade 1', 'Grade 2', 'Grade 3'] },
  { name: 'Upper Primary', classNames: ['Grade 4', 'Grade 5', 'Grade 6'] },
  { name: 'Junior Secondary', classNames: ['Grade 7', 'Grade 8', 'Grade 9'] },
]

/** Same match rule as marklist/page.tsx: exact name, or "<base name> <stream>".
 * Case-insensitive - schools type their own class names in free text (a real
 * class was created as "PlayGroup", not "Playgroup"), so an exact-case match
 * would silently drop it out of every CBC-level-based feature. */
export function getCategoryForClass(className: string): string | null {
  const trimmed = className.trim().toLowerCase()
  for (const category of CBC_CATEGORIES) {
    if (category.classNames.some((catName) => {
      const normalized = catName.toLowerCase()
      return trimmed === normalized || trimmed.startsWith(normalized + ' ')
    })) {
      return category.name
    }
  }
  return null
}
