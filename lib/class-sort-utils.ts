/**
 * Sort classes in logical order: PLAYGROUP, PP1, PP2, Grade 1-9, etc.
 * Falls back to display_order if available, then alphabetical.
 */
export function sortClassesByLevel(classes: any[]): any[] {
  // Define base class names with explicit sort order
  const classOrder: { [key: string]: number } = {
    'PLAYGROUP': 0,
    'PP1': 1,
    'PP2': 2,
  }

  // Add Grade 1-9 in order (grades start at 3)
  for (let i = 1; i <= 9; i++) {
    classOrder[`Grade ${i}`] = 2 + i
    classOrder[`Grade${i}`] = 2 + i
    classOrder[`GRD${i}`] = 2 + i
    classOrder[`Form ${i}`] = 2 + i
  }

  return [...classes].sort((a, b) => {
    const aName = a.name || ''
    const bName = b.name || ''
    
    // Try exact match first
    let aOrder = classOrder[aName]
    let bOrder = classOrder[bName]

    // If not exact, try extracting Grade/Form number
    if (aOrder === undefined) {
      const gradeMatch = aName.match(/(?:Grade|Form|GRD)[\s-]*(\d+)/i)
      if (gradeMatch) {
        aOrder = 3 + parseInt(gradeMatch[1])
      }
    }
    if (bOrder === undefined) {
      const gradeMatch = bName.match(/(?:Grade|Form|GRD)[\s-]*(\d+)/i)
      if (gradeMatch) {
        bOrder = 3 + parseInt(gradeMatch[1])
      }
    }

    // If both have numeric grades, compare them
    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder
    }

    // If only a has a grade, it comes first
    if (aOrder !== undefined) {
      return -1
    }

    // If only b has a grade, it comes first
    if (bOrder !== undefined) {
      return 1
    }

    // Fall back to display_order if set
    const aDisplay = a.display_order ?? 999
    const bDisplay = b.display_order ?? 999
    if (aDisplay !== bDisplay) {
      return aDisplay - bDisplay
    }

    // Finally, sort alphabetically
    return aName.localeCompare(bName)
  })
}
