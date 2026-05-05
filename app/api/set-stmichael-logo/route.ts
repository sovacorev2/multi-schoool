import { createClient } from '@supabase/supabase-js'

export async function GET() {
  return handleRequest()
}

export async function POST() {
  return handleRequest()
}

async function handleRequest() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: 'Missing Supabase credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Update St Michael Nakhwana with the Blob logo URL
    const { data: stMichael, error: updateError } = await supabase
      .from('schools')
      .update({ 
        logo_url: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/stmichaellogo-uFafBc9amB4gT3cJroyU531usCnSy8.jpeg'
      })
      .ilike('name', '%st michael%')
      .select('id, name, logo_url')

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json({
      message: 'St Michael logo updated successfully',
      updated: stMichael,
      logoUrl: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/stmichaellogo-uFafBc9amB4gT3cJroyU531usCnSy8.jpeg'
    })
  } catch (error) {
    console.error('[v0] Error updating St Michael logo:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
