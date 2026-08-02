import { sortClassesByLevel } from '@/lib/class-sort-utils'
import type { Class } from '@/lib/types'

export const TERMS = ['Term 1', 'Term 2', 'Term 3']

export function sortClasses(classes: Class[]): Class[] {
  return sortClassesByLevel(classes)
}

// Extract base class name (e.g., "Grade 7" from "Grade 7 EAST")
export function getBaseClassName(className: string): string {
  const match = className.match(/^(PLAYGROUP|PP\d+|Grade\s*\d+|Form\s*\d+)(?:\s+(.+))?$/i)
  return match ? match[1] : className
}

export interface BaseClassInfo {
  name: string
  streamCount: number
}

export function getUniqueBaseClasses(classes: Class[]): BaseClassInfo[] {
  const baseClassMap = new Map<string, Set<string>>()

  classes.forEach(cls => {
    const baseName = getBaseClassName(cls.name).trim()
    if (!baseClassMap.has(baseName)) {
      baseClassMap.set(baseName, new Set())
    }
    baseClassMap.get(baseName)!.add(cls.id)
  })

  const baseClasses: BaseClassInfo[] = Array.from(baseClassMap.entries()).map(([name, ids]) => ({
    name,
    streamCount: ids.size,
  }))

  return baseClasses.sort((a, b) => {
    const aMatch = a.name.match(/\d+/)
    const bMatch = b.name.match(/\d+/)
    const aNum = aMatch ? parseInt(aMatch[0]) : 999
    const bNum = bMatch ? parseInt(bMatch[0]) : 999
    return aNum - bNum
  })
}

export function getStreamsForBaseClass(classes: Class[], baseName: string): Class[] {
  return classes
    .filter(cls => getBaseClassName(cls.name) === baseName)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// sessionStorage key used to skip re-entering the admin password after the
// no-password "peek into a class" bypass flow navigates back here.
export function sessionAuthKey(code: string): string {
  return `admin_portal_authed_${code}`
}
