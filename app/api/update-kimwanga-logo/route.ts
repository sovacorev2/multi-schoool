import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Update Kimwanga with the blob logo
    const { data, error } = await supabase
      .from('schools')
      .update({ 
        logo_url: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp%20Image%202026-05-08%20at%2018.29.25-96Us4icdfQM1wKEVm8sVw3o4U0Mg03.jpeg'
      })
      .ilike('name', '%kimwanga%')
      .select('id, name, logo_url')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Kimwanga logo updated',
      updated: data
    })
  } catch (error) {
    console.error('[v0] Error updating Kimwanga logo:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
