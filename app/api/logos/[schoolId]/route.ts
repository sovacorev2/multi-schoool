import { get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    const schoolId = params.schoolId

    // Get the logo URL from database
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

    if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/schools?id=eq.${schoolId}&select=logo_url`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    )

    const schools = await response.json()
    if (!schools || schools.length === 0 || !schools[0].logo_url) {
      return NextResponse.json(
        { error: 'Logo not found' },
        { status: 404 }
      )
    }

    const logoUrl = schools[0].logo_url

    // Fetch the blob file from Vercel Blob using the stored URL
    const blobResponse = await fetch(logoUrl)

    if (!blobResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch logo' },
        { status: 500 }
      )
    }

    const buffer = await blobResponse.arrayBuffer()
    const contentType = blobResponse.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('[v0] Error fetching logo:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logo' },
      { status: 500 }
    )
  }
}
