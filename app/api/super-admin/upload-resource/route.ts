import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Same proven pattern as app/api/admin/upload-school-logo: convert the file
// to a base64 data URL and store it directly in the row via the service-role
// key. No Supabase Storage bucket in this project yet, and this path is
// already known to work in production rather than introducing untested
// Storage bucket + policy setup for this feature.
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const resourceType = formData.get('resource_type') as string
    const title = (formData.get('title') as string || '').trim()
    const description = (formData.get('description') as string || '').trim()
    const classLevel = (formData.get('class_level') as string || '').trim()
    const subject = (formData.get('subject') as string || '').trim()
    const term = (formData.get('term') as string || '').trim()

    if (!file || !resourceType || !title) {
      return NextResponse.json({ error: 'Missing file, resource_type, or title' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File is too large (max 15MB)' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'application/octet-stream'
    const dataUrl = `data:${mimeType};base64,${base64}`

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data, error } = await supabase
      .from('resources')
      .insert({
        resource_type: resourceType,
        title,
        description: description || null,
        class_level: classLevel || null,
        subject: subject || null,
        term: term || null,
        file_data_url: dataUrl,
        file_name: file.name,
        file_size_bytes: file.size,
        uploaded_by: 'Super Admin',
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, id: data.id })
  } catch (error) {
    console.error('[upload-resource] Error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 })
  }
}
