const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  try {
    // Check schools
    const { data: schools, error: schoolsErr } = await supabase
      .from('schools')
      .select('id, name, code')
      .limit(10);
    
    if (schoolsErr) throw schoolsErr;
    console.log('Schools found:', schools?.length || 0);
    if (schools?.length > 0) {
      console.log('First few schools:', schools.slice(0, 3));
    }

    // Check students
    const { data: students, error: studentsErr } = await supabase
      .from('students')
      .select('id, name, school_id')
      .limit(5);
    
    if (studentsErr) throw studentsErr;
    console.log('Students found:', students?.length || 0);
    if (students?.length > 0) {
      console.log('First few students:', students.slice(0, 3));
    }

    // Check classes
    const { data: classes, error: classesErr } = await supabase
      .from('classes')
      .select('id, name, school_id')
      .limit(5);
    
    if (classesErr) throw classesErr;
    console.log('Classes found:', classes?.length || 0);
    if (classes?.length > 0) {
      console.log('First few classes:', classes.slice(0, 3));
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkData();
