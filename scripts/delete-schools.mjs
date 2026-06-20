#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[v0] Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SCHOOLS_TO_DELETE = [
  'SHULE TECH',
  'KITENGELA BOYS HIGH SCHOOL',
  'ST JAMES MUSOKOTO B. SCHOOL'
];

async function deleteSchools() {
  try {
    console.log('[v0] Starting deletion of 3 schools...\n');

    // Find schools
    console.log('[v0] Finding schools to delete:');
    const { data: schools, error: findError } = await supabase
      .from('schools')
      .select('id, name, code')
      .or(SCHOOLS_TO_DELETE.map(name => `name.ilike.%${name}%`).join(','));

    if (findError) {
      console.error('[v0] Error finding schools:', findError);
      process.exit(1);
    }

    if (!schools || schools.length === 0) {
      console.log('[v0] ⚠️  No schools found matching the search criteria');
      return;
    }

    console.log(`[v0] Found ${schools.length} schools to delete:`);
    schools.forEach(s => console.log(`  - ${s.name} (${s.code})`));
    console.log('');

    // Get stats on data to be deleted
    for (const school of schools) {
      const { count: classCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact' })
        .eq('school_id', school.id);

      const { count: learnerCount } = await supabase
        .from('learners')
        .select('*', { count: 'exact' })
        .in('class_id', (await supabase
          .from('classes')
          .select('id')
          .eq('school_id', school.id)).data.map(c => c.id) || []);

      console.log(`[v0] ${school.name}: ${classCount || 0} classes, ${learnerCount || 0} learners`);
    }
    console.log('');

    // Delete schools (cascade will handle related data)
    console.log('[v0] Deleting schools and all associated data...');
    const schoolIds = schools.map(s => s.id);
    
    const { error: deleteError } = await supabase
      .from('schools')
      .delete()
      .in('id', schoolIds);

    if (deleteError) {
      console.error('[v0] Error deleting schools:', deleteError);
      process.exit(1);
    }

    console.log('[v0] ✓ Successfully deleted all 3 schools and their data');
    console.log('[v0] Deleted:');
    schools.forEach(s => console.log(`  ✓ ${s.name}`));
    console.log('\n[v0] This will help reduce database disk I/O usage.');

  } catch (error) {
    console.error('[v0] Unexpected error:', error);
    process.exit(1);
  }
}

deleteSchools();
