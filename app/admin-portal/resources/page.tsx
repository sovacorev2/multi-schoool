'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSchool } from '@/lib/school-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FolderOpen, FileText, Download, ChevronDown, ChevronRight } from 'lucide-react'

const RESOURCE_TYPES = [
  { value: 'exam', label: 'Exams' },
  { value: 'marking_scheme', label: 'Marking Schemes' },
  { value: 'scheme_of_work', label: 'Schemes of Work' },
  { value: 'cbc_project', label: 'CBC Projects' },
  { value: 'other', label: 'Other' },
]

interface ResourceRow {
  id: string
  resource_type: string
  title: string
  description: string | null
  class_level: string | null
  subject: string | null
  term: string | null
  file_name: string
  file_size_bytes: number
}

export default function AdminPortalResourcesPage() {
  const { currentSchool } = useSchool()
  const [resources, setResources] = useState<ResourceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      const supabase = createClient()
      // Global library, not scoped by school - just the lightweight metadata,
      // never the base64 file_data_url, for every row in the list.
      const { data } = await supabase
        .from('resources')
        .select('id, resource_type, title, description, class_level, subject, term, file_name, file_size_bytes')
        .order('class_level')
        .order('subject')
        .order('title')
      if (cancelled) return
      setResources((data || []) as ResourceRow[])
      setIsLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const handleDownload = async (resource: ResourceRow) => {
    setDownloadingId(resource.id)
    const supabase = createClient()
    const { data, error } = await supabase.from('resources').select('file_data_url').eq('id', resource.id).single()
    setDownloadingId(null)
    if (error || !data) {
      alert(`Failed to load file: ${error?.message || 'not found'}`)
      return
    }
    // Cross-origin URLs (Supabase Storage's public URL) ignore the anchor
    // "download" attribute in most browsers - opening in a new tab works
    // reliably for both that and legacy base64 data: URLs.
    window.open(data.file_data_url, '_blank', 'noopener,noreferrer')
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const byType = useMemo(() => {
    const map: Record<string, ResourceRow[]> = {}
    for (const t of RESOURCE_TYPES) map[t.value] = resources.filter((r) => r.resource_type === t.value)
    return map
  }, [resources])

  const resourceRow = (r: ResourceRow) => (
    <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg text-sm bg-white">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium truncate">{r.title}</p>
          {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => handleDownload(r)} disabled={downloadingId === r.id} className="shrink-0">
        <Download className="w-4 h-4 mr-1" /> {downloadingId === r.id ? 'Loading...' : 'Download'}
      </Button>
    </div>
  )

  // Exams/CBC projects/other: grouped by class only.
  // Marking schemes/schemes of work: grouped by class, then subject.
  const renderGroupedByClass = (items: ResourceRow[], withSubject: boolean) => {
    const byClass = new Map<string, ResourceRow[]>()
    for (const r of items) {
      const key = r.class_level || 'Unclassified'
      if (!byClass.has(key)) byClass.set(key, [])
      byClass.get(key)!.push(r)
    }
    if (byClass.size === 0) return <p className="text-sm text-gray-500 py-6 text-center">No resources here yet.</p>

    return (
      <div className="space-y-2">
        {[...byClass.entries()].map(([className, classItems]) => {
          const groupKey = `class:${className}`
          const isOpen = expandedGroups.has(groupKey)
          return (
            <div key={className} className="border rounded-lg overflow-hidden">
              <button onClick={() => toggleGroup(groupKey)} className="w-full flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 text-left font-medium text-sm">
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                {className}
                <span className="text-xs text-gray-400 font-normal">({classItems.length})</span>
              </button>
              {isOpen && (
                <div className="p-3 space-y-2">
                  {withSubject ? (
                    (() => {
                      const bySubject = new Map<string, ResourceRow[]>()
                      for (const r of classItems) {
                        const key = r.subject || 'General'
                        if (!bySubject.has(key)) bySubject.set(key, [])
                        bySubject.get(key)!.push(r)
                      }
                      return [...bySubject.entries()].map(([subject, subjectItems]) => (
                        <div key={subject}>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{subject}</p>
                          <div className="space-y-2">{subjectItems.map(resourceRow)}</div>
                        </div>
                      ))
                    })()
                  ) : (
                    classItems.map(resourceRow)
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!currentSchool?.feature_exam_hub) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          Resource Centre isn&apos;t enabled for this school yet. Contact ShuleTech to have it switched on.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FolderOpen className="w-6 h-6" />
          Resource Centre
        </h1>
        <p className="text-gray-500">Exams, marking schemes, schemes of work, and CBC project resources from ShuleTech.</p>
      </div>

      <Tabs defaultValue="exam" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {RESOURCE_TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label} ({byType[t.value]?.length || 0})</TabsTrigger>
          ))}
        </TabsList>
        {RESOURCE_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {renderGroupedByClass(byType[t.value] || [], t.value === 'marking_scheme' || t.value === 'scheme_of_work')}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
