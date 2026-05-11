import { createClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const schoolId = formData.get('schoolId') as string

    if (!file || !schoolId) {
      return NextResponse.json(
        { error: 'Missing file or schoolId' },
        { status: 400 }
      )
    }

    console.log('[v0] Uploading logo for school:', schoolId)

    // Upload to Blob storage with public access
    const buffer = await file.arrayBuffer()
    const filename = `school-logos/${schoolId}-${Date.now()}-${file.name}`
    
    const blob = await put(filename, buffer, {
      access: 'public',
    })

    console.log('[v0] File uploaded to Blob:', blob.url)

    // Store the blob URL directly in database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data: school, error: updateError } = await supabase
      .from('schools')
      .update({ logo_url: blob.url })
      .eq('id', schoolId)
      .select('id, name, logo_url')
      .single()

    if (updateError) {
      throw updateError
    }

    console.log('[v0] Logo saved for school:', school.name)

    return NextResponse.json({
      success: true,
      message: 'Logo uploaded successfully',
      school,
      logoUrl: blob.url
    })
  } catch (error) {
    console.error('[v0] Error uploading logo:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
