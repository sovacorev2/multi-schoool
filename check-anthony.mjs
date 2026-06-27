import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

console.log('\n=== ANTHONY EBU (PIN 7847) DATA CHECK ===\n')

// Find teacher by PIN
const { data: teacher } = await supabase
  .from('teacher_accounts')
  .select('*')
  .eq('pin', '7847')
  .single()

if (!teacher) {
  console.log('❌ Teacher not found by PIN 7847')
  process.exit(1)
}

console.log('✓ Teacher found:', teacher.name, 'ID:', teacher.id, 'School:', teacher.school_id)

// Get all assignments for this teacher
const { data: assignments } = await supabase
  .from('teacher_assignments')
  .select('*')
  .eq('user_id', teacher.id)

console.log(`\n✓ Total assignments: ${assignments?.length || 0}`)

// Group by class to show what each teacher can access
const byClass = {}
assignments?.forEach(a => {
  if (!byClass[a.class_id]) byClass[a.class_id] = []
  byClass[a.class_id].push(a)
})

for (const [classId, assigns] of Object.entries(byClass)) {
  const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
  const classTeacherAssign = assigns.find(a => !a.subject_id)
  const subjects = assigns.filter(a => a.subject_id).map(a => a.subject_id)
  
  console.log(`\n  Class: ${cls?.name || classId}`)
  console.log(`    Is Class Teacher: ${!!classTeacherAssign}`)
  console.log(`    Assigned Subjects (${subjects.length}):`, subjects.join(', ') || 'NONE')
}

// Check if there's a fallback access giving him all classes
console.log('\n=== CHECKING FOR BYPASS LOGIC ===')
console.log('If teacher has ANY assignment with subject_id=null, they are class teacher')
const classTeacherAssigns = assignments?.filter(a => !a.subject_id) || []
console.log(`Class teacher assignments (subject_id = NULL): ${classTeacherAssigns.length}`)
if (classTeacherAssigns.length > 0) {
  console.log('⚠️  WARNING: Teacher has class teacher status in these classes:')
  for (const a of classTeacherAssigns) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', a.class_id).single()
    console.log(`    - ${cls?.name}`)
  }
}

