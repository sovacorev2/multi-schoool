'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FolderOpen, Upload, Trash2, FileText, Download } from 'lucide-react'
import { SUPER_ADMIN_PASSWORD } from '../_shared/auth'

const RESOURCE_TYPES = [
  { value: 'exam', label: 'Exams' },
  { value: 'marking_scheme', label: 'Marking Schemes' },
  { value: 'scheme_of_work', label: 'Schemes of Work' },
  { value: 'cbc_project', label: 'CBC Projects' },
  { value: 'other', label: 'Other' },
]

const CLASS_LEVELS = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9']

const needsClass = (type: string) => type !== 'other'
const needsSubject = (type: string) => type === 'marking_scheme' || type === 'scheme_of_work'

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
  created_at: string
}

export default function SuperAdminResourcesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [resources, setResources] = useState<ResourceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState({ resource_type: 'exam', title: '', description: '', class_level: '', subject: '', term: '' })
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const loadResources = async () => {
    setIsLoading(true)
    const supabase = createClient()
    // Never select file_data_url here - it's a base64 blob that could be
    // several MB per row; the list only needs lightweight metadata.
    const { data } = await supabase
      .from('resources')
      .select('id, resource_type, title, description, class_level, subject, term, file_name, file_size_bytes, created_at')
      .order('created_at', { ascending: false })
    setResources((data || []) as ResourceRow[])
    setIsLoading(false)
  }

  useEffect(() => {
    if (isAuthenticated) loadResources()
  }, [isAuthenticated])

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === SUPER_ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setAuthError('')
    } else {
      setAuthError('Invalid password')
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !form.title.trim()) return
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('File is too large (max 15MB)')
      return
    }
    setIsUploading(true)
    setUploadError('')
    setUploadSuccess(false)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('resource_type', form.resource_type)
      body.append('title', form.title.trim())
      body.append('description', form.description.trim())
      body.append('class_level', form.class_level)
      body.append('subject', form.subject)
      body.append('term', form.term)

      const res = await fetch('/api/super-admin/upload-resource', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setUploadSuccess(true)
      setForm((prev) => ({ resource_type: prev.resource_type, title: '', description: '', class_level: '', subject: '', term: '' }))
      setFile(null)
      const fileInput = document.getElementById('resource-file-input') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      loadResources()
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = async (resource: ResourceRow) => {
    setDownloadingId(resource.id)
    const supabase = createClient()
    const { data, error } = await supabase.from('resources').select('file_data_url').eq('id', resource.id).single()
    setDownloadingId(null)
    if (error || !data) {
      alert(`Failed to load file: ${error?.message || 'not found'}`)
      return
    }
    const a = document.createElement('a')
    a.href = data.file_data_url
    a.download = resource.file_name
    a.click()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resource? This removes it from every school immediately and cannot be undone.')) return
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('resources').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      alert(`Failed to delete: ${error.message}`)
      return
    }
    setResources((prev) => prev.filter((r) => r.id !== id))
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-teal-600" />
              Resource Centre
            </CardTitle>
            <CardDescription>Super Admin Portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" autoFocus />
              </div>
              {authError && <p className="text-sm text-red-600">{authError}</p>}
              <Button type="submit" className="w-full">Login</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const groupedByType = RESOURCE_TYPES.map((t) => ({ ...t, items: resources.filter((r) => r.resource_type === t.value) }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-emerald-700 rounded-xl flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Resource Centre</h1>
                <p className="text-xs text-gray-500">Exams, marking schemes, schemes of work &amp; more</p>
              </div>
            </div>
            <a href="/super-admin"><Button variant="outline" size="sm">Back to Schools</Button></a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Add a Resource</CardTitle>
            <CardDescription>Uploaded here becomes visible in every school&apos;s Resource Centre that has this feature enabled.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mathematics End Term Exam" className="mt-1" required />
                </div>
                {needsClass(form.resource_type) && (
                  <div>
                    <Label>Class</Label>
                    <Select value={form.class_level} onValueChange={(v) => setForm({ ...form, class_level: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                      <SelectContent>
                        {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {needsSubject(form.resource_type) && (
                  <div>
                    <Label>Subject</Label>
                    <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics" className="mt-1" />
                  </div>
                )}
                {form.resource_type === 'exam' && (
                  <div>
                    <Label>Term (optional)</Label>
                    <Input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="e.g. Term 2" className="mt-1" />
                  </div>
                )}
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} />
              </div>
              <div>
                <Label>File</Label>
                <input id="resource-file-input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100" required />
                <p className="text-xs text-gray-500 mt-1">PDF, Word, or image. Max 15MB.</p>
              </div>
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              {uploadSuccess && <p className="text-sm text-emerald-600">Uploaded successfully.</p>}
              <Button type="submit" disabled={isUploading}>
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Resource'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
          </div>
        ) : resources.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No resources uploaded yet.</p>
        ) : (
          groupedByType.map((group) =>
            group.items.length === 0 ? null : (
              <Card key={group.value}>
                <CardHeader>
                  <CardTitle className="text-base">{group.label} ({group.items.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.items.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.title}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {[r.class_level, r.subject, r.term].filter(Boolean).join(' · ') || 'No class/subject set'}
                            {' · '}{(r.file_size_bytes / 1024 / 1024).toFixed(1)}MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(r)} disabled={downloadingId === r.id}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          )
        )}
      </main>
    </div>
  )
}
