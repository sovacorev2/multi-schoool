import { list } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = decodeURIComponent(params.filename)
    
    console.log('[v0] Attempting to serve logo:', filename)
    
    // Use list to find the blob
    const { blobs } = await list({
      prefix: 'school-logos/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    
    const blob = blobs.find(b => b.pathname === filename)
    
    if (!blob) {
      console.log('[v0] Logo not found:', filename)
      return NextResponse.json(
        { error: 'Logo not found' },
        { status: 404 }
      )
    }

    console.log('[v0] Found blob, fetching from URL:', blob.url)
    
    // Fetch the actual blob content
    const response = await fetch(blob.url)
    
    if (!response.ok) {
      console.error('[v0] Failed to fetch blob:', response.status)
      return NextResponse.json(
        { error: 'Failed to fetch logo' },
        { status: response.status }
      )
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Return the blob with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[v0] Error serving logo:', error)
    return NextResponse.json(
      { error: 'Failed to serve logo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
