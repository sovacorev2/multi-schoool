import type { ReactNode } from 'react'

// Scopes STEMS brand colors (navy + teal, pulled from public/icon-512.png)
// to everything under /requisition by overriding the shared design-system
// CSS variables on a wrapper div - every existing Button/Badge/Card variant
// picks these up automatically via the cascade, with zero changes to the
// shared components or any effect on the rest of the exam system, which
// keeps its own blue theme untouched outside this subtree.
const STEMS_THEME = {
  '--primary': '222 47% 16%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '187 75% 35%',
  '--secondary-foreground': '0 0% 100%',
  '--accent': '187 55% 94%',
  '--accent-foreground': '222 47% 16%',
  '--ring': '187 75% 35%',
} as React.CSSProperties

export default function RequisitionLayout({ children }: { children: ReactNode }) {
  return <div style={STEMS_THEME}>{children}</div>
}
