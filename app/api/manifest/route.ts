import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get school from query params or session
    const schoolId = request.nextUrl.searchParams.get('schoolId')
    const schoolName = request.nextUrl.searchParams.get('schoolName')

    if (!schoolId && !schoolName) {
      // Return default manifest if no school specified
      return NextResponse.json({
        name: 'Shuletech Exam System',
        short_name: 'Shuletech',
        description: 'Multi-school exam marks management system for teachers and administrators',
        start_url: '/select-school',
        id: '/select-school',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0D9488',
        orientation: 'any',
        scope: '/',
        prefer_related_applications: false,
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
      })
    }

    // Fetch school details from Supabase if schoolId provided
    let school = null
    if (schoolId) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('schools')
        .select('name, primary_color, logo_url')
        .eq('id', schoolId)
        .single()

      school = data
    } else if (schoolName) {
      // Use provided school name
      school = { name: schoolName, primary_color: '#0D9488' }
    }

    const appName = school?.name || 'Shuletech'
    const themeColor = school?.primary_color || '#0D9488'
    const startUrl = schoolId ? `/teacher-login?school=${schoolId}` : `/select-school`

    return NextResponse.json({
      name: `${appName} - Exam System`,
      short_name: appName.substring(0, 12),
      description: `${appName} exam marks management system`,
      start_url: startUrl,
      id: startUrl,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: themeColor,
      orientation: 'any',
      scope: '/',
      prefer_related_applications: false,
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
    })
  } catch (error) {
    console.error('[v0] Manifest API error:', error)
    return NextResponse.json({ error: 'Failed to generate manifest' }, { status: 500 })
  }
}
