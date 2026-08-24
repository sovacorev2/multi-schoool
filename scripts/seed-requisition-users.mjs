// One-time setup: creates the 4 ShuleTech executive accounts in Supabase
// Auth. Run locally only (needs the service role key) - never deploy or
// commit this being run against production without reviewing the list below.
//
// Usage:
//   node --env-file=.env.local scripts/seed-requisition-users.mjs
//
// Prints each person's temporary password once - relay it to them yourself
// (Slack DM, in person, etc.), never by email through this same system.
// Everyone should change their password after first login.

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - check .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PEOPLE = [
  { email: 'levis.mokaya@shuletechsolutions.co.ke', full_name: 'Levis Mokaya', is_approver: false },
  { email: 'brian.onyango@shuletechsolutions.co.ke', full_name: 'Brian Onyango', is_approver: false },
  { email: 'patricia.akumu@shuletechsolutions.co.ke', full_name: 'Patricia Akumu', is_approver: false },
  { email: 'sambai.dayena@shuletechsolutions.co.ke', full_name: 'Diana Sambai', is_approver: true },
]

function generateTempPassword() {
  return randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12)
}

for (const person of PEOPLE) {
  const tempPassword = generateTempPassword()

  const { data, error } = await supabase.auth.admin.createUser({
    email: person.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: person.full_name, is_approver: person.is_approver },
  })

  if (error) {
    console.error(`Failed to create ${person.email}: ${error.message}`)
    continue
  }

  console.log(`Created ${person.full_name} <${person.email}>${person.is_approver ? ' (approver)' : ''} - temporary password: ${tempPassword}`)
}

console.log('\nDone. Share each temporary password with its owner directly and have them change it after first login.')
