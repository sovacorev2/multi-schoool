import { get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename
    
    // Fetch the blob file
    const blob = await get(filename, { access: 'private' })
    
    if (!blob) {
      return NextResponse.json(
        { error: 'Logo not found' },
        { status: 404 }
      )
    }

    // Return the blob with appropriate headers
    return new NextResponse(blob.body, {
      headers: {
        'Content-Type': blob.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[v0] Error serving logo:', error)
    return NextResponse.json(
      { error: 'Failed to serve logo' },
      { status: 500 }
    )
  }
}
