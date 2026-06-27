import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: classes } = await supabase.from('classes').select('*').limit(1)
if (classes?.[0]) {
  console.log('Sample class columns:', Object.keys(classes[0]))
  console.log('Sample class:', JSON.stringify(classes[0], null, 2))
}
