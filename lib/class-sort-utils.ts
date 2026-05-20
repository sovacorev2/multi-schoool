/**
 * Sort classes with PLAYGROUP, PP1, PP2 first in that order, then others by display_order
 */
export function sortClassesByLevel(classes: any[]): any[] {
  const classOrder: { [key: string]: number } = {
    'PLAYGROUP': 0,
    'PP1': 1,
    'PP2': 2,
  }

  return [...classes].sort((a, b) => {
    const aOrder = classOrder[a.name]
    const bOrder = classOrder[b.name]

    // If both are in priority list, sort by priority
    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder
    }

    // If only a is in priority list, it comes first
    if (aOrder !== undefined) {
      return -1
    }

    // If only b is in priority list, it comes first
    if (bOrder !== undefined) {
      return 1
    }

    // Otherwise sort by display_order
    return (a.display_order || 0) - (b.display_order || 0)
  })
}
