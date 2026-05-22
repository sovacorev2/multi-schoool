import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')
    const schoolName = searchParams.get('schoolName') || 'Admin Portal'

    // Fetch school info for colors if schoolId is provided
    let primaryColor = '#2563eb' // default blue
    let schoolShortName = 'Admin'

    if (schoolId) {
      const supabase = await createClient()
      const { data: school } = await supabase
        .from('schools')
        .select('primary_color, short_name')
        .eq('id', schoolId)
        .single()

      if (school) {
        primaryColor = school.primary_color || primaryColor
        schoolShortName = school.short_name || 'Admin'
      }
    }

    const manifest = {
      name: `${schoolName} - Admin Portal`,
      short_name: schoolShortName,
      description: 'School Management Admin Portal',
      start_url: schoolId ? `/admin-portal?schoolId=${schoolId}` : '/admin-portal',
      scope: '/admin-portal',
      display: 'standalone',
      orientation: 'portrait-primary',
      theme_color: primaryColor,
      background_color: '#ffffff',
      // Use main app icons (already exist in public/icon-*.png)
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      categories: ['education', 'productivity'],
      shortcuts: [
        {
          name: 'Classes',
          short_name: 'Classes',
          description: 'View and manage classes',
          url: '/admin-portal?tab=classes',
          icons: [{ src: '/icon-192.png', sizes: '192x192' }],
        },
        {
          name: 'Teachers',
          short_name: 'Teachers',
          description: 'Manage teachers and assignments',
          url: '/admin-portal?tab=teachers',
          icons: [{ src: '/icon-192.png', sizes: '192x192' }],
        },
      ],
    }

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
      },
    })
  } catch (error) {
    console.error('[v0] Error generating admin manifest:', error)
    return NextResponse.json(
      { error: 'Failed to generate manifest' },
      { status: 500 }
    )
  }
}
