import { createClient } from '@supabase/supabase-js'
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

    // Convert file to base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    console.log('[v0] File converted to base64, size:', dataUrl.length)

    // Save the logo URL to database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data: school, error: updateError } = await supabase
      .from('schools')
      .update({ logo_url: dataUrl })
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
      logoUrl: dataUrl
    })
  } catch (error) {
    console.error('[v0] Error uploading logo:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
