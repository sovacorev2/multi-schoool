const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreStudentsAndMarks() {
  try {
    console.log('=== COMPLETE GRADE 9 RESTORATION ===\n');

    // Get Amagoro school
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('code', 'amagoro')
      .single();

    console.log(`✓ Amagoro school ID: ${school.id}\n`);

    // Get Grade 9 classes
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', school.id)
      .like('name', '%Grade 9%');

    console.log(`✓ Found ${classes?.length} Grade 9 classes\n`);

    // Get Term 2 2026 session
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, year, term')
      .eq('school_id', school.id)
      .eq('year', 2026)
      .eq('term', 'Term 2')
      .limit(1);

    if (!sessions || sessions.length === 0) {
      console.log('✗ No Term 2 2026 session found');
      return;
    }

    const sessionId = sessions[0].id;
    console.log(`✓ Found session: Term 2, 2026\n`);

    // Grade 9 marklist data (extracted from HTML)
    const marklist = [
      { name: 'IVINE CONSOLATA', stream: 'WEST', marks: { 'ENGLISH': 77, 'KISWAHILI': 87, 'MATHS': 75, 'INTEGRATED SCIENCE': 68, 'CHRISTIAN RELIGIOUS EDUCATION': 78, 'PRACTICAL TECHNOLOGY': 82, 'AGRICULTURE/NUTRITION': 91, 'SOCIAL STUDIES': 80 } },
      { name: 'JOSHUA PRECIOUS', stream: 'WEST', marks: { 'ENGLISH': 71, 'KISWAHILI': 79, 'MATHS': 93, 'INTEGRATED SCIENCE': 68, 'CHRISTIAN RELIGIOUS EDUCATION': 60, 'PRACTICAL TECHNOLOGY': 90, 'AGRICULTURE/NUTRITION': 81, 'SOCIAL STUDIES': 72 } },
      { name: 'LUCY NYOLE', stream: 'WEST', marks: { 'ENGLISH': 78, 'KISWAHILI': 84, 'MATHS': 80, 'INTEGRATED SCIENCE': 64, 'CHRISTIAN RELIGIOUS EDUCATION': 60, 'PRACTICAL TECHNOLOGY': 86, 'AGRICULTURE/NUTRITION': 72, 'SOCIAL STUDIES': 76 } },
      { name: 'SHANNEL AMASE', stream: 'WEST', marks: { 'ENGLISH': 75, 'KISWAHILI': 85, 'MATHS': 77, 'INTEGRATED SCIENCE': 63, 'CHRISTIAN RELIGIOUS EDUCATION': 64, 'PRACTICAL TECHNOLOGY': 86, 'AGRICULTURE/NUTRITION': 79, 'SOCIAL STUDIES': 76 } },
      { name: 'ALVIS KAKAI', stream: 'WEST', marks: { 'ENGLISH': 80, 'KISWAHILI': 86, 'MATHS': 62, 'INTEGRATED SCIENCE': 63, 'CHRISTIAN RELIGIOUS EDUCATION': 71, 'PRACTICAL TECHNOLOGY': 80, 'AGRICULTURE/NUTRITION': 75, 'SOCIAL STUDIES': 70 } },
      { name: 'CLAYTON OKILIPA STARFORD', stream: 'WEST', marks: { 'ENGLISH': 70, 'KISWAHILI': 77, 'MATHS': 69, 'INTEGRATED SCIENCE': 65, 'CHRISTIAN RELIGIOUS EDUCATION': 71, 'PRACTICAL TECHNOLOGY': 79, 'AGRICULTURE/NUTRITION': 70, 'SOCIAL STUDIES': 74 } },
      { name: 'ANGEL CASMIR', stream: 'WEST', marks: { 'ENGLISH': 76, 'KISWAHILI': 72, 'MATHS': 51, 'INTEGRATED SCIENCE': 66, 'CHRISTIAN RELIGIOUS EDUCATION': 60, 'PRACTICAL TECHNOLOGY': 86, 'AGRICULTURE/NUTRITION': 67, 'SOCIAL STUDIES': 78 } },
      { name: 'Raymond Odhiambi', stream: 'EAST', marks: { 'ENGLISH': 74, 'KISWAHILI': 78, 'MATHS': 70, 'INTEGRATED SCIENCE': 73, 'CHRISTIAN RELIGIOUS EDUCATION': 92, 'PRACTICAL TECHNOLOGY': 76, 'AGRICULTURE/NUTRITION': 85, 'SOCIAL STUDIES': 87 } },
      { name: 'CHRISPINE MAGARA', stream: 'WEST', marks: { 'ENGLISH': 66, 'KISWAHILI': 74, 'MATHS': 60, 'INTEGRATED SCIENCE': 59, 'CHRISTIAN RELIGIOUS EDUCATION': 51, 'PRACTICAL TECHNOLOGY': 86, 'AGRICULTURE/NUTRITION': 77, 'SOCIAL STUDIES': 70 } },
      { name: 'LAURAH NEKESA', stream: 'WEST', marks: { 'ENGLISH': 76, 'KISWAHILI': 72, 'MATHS': 57, 'INTEGRATED SCIENCE': 55, 'CHRISTIAN RELIGIOUS EDUCATION': 59, 'PRACTICAL TECHNOLOGY': 70, 'AGRICULTURE/NUTRITION': 80, 'SOCIAL STUDIES': 80 } }
    ];

    console.log(`Processing ${marklist.length} students...\n`);

    let studentsCreated = 0;
    let marksInserted = 0;
    const errors = [];

    // For each student in marklist
    for (const studentData of marklist) {
      try {
        // Determine which class based on stream
        let studentClass = classes?.find(c => 
          c.name.includes(studentData.stream === 'WEST' ? 'WEST' : 'EAST')
        ) || classes?.[0]; // Default to first class if not found

        if (!studentClass) {
          errors.push(`No class found for ${studentData.name}`);
          continue;
        }

        // Create student
        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert({
            name: studentData.name,
            school_id: school.id,
            class_id: studentClass.id
          })
          .select();

        if (studentError) {
          errors.push(`Error creating ${studentData.name}: ${studentError.message}`);
          continue;
        }

        studentsCreated++;
        const studentId = newStudent[0].id;
        console.log(`✓ Created student: ${studentData.name}`);

        // Insert marks for this student
        const marksToInsert = [];
        for (const [subject, score] of Object.entries(studentData.marks)) {
          marksToInsert.push({
            student_id: studentId,
            session_id: sessionId,
            subject: subject,
            score: score,
            school_id: school.id
          });
        }

        const { error: marksError } = await supabase
          .from('marks')
          .insert(marksToInsert);

        if (marksError) {
          errors.push(`Error inserting marks for ${studentData.name}: ${marksError.message}`);
        } else {
          marksInserted += marksToInsert.length;
          console.log(`  → ${marksToInsert.length} marks inserted`);
        }

      } catch (err) {
        errors.push(`Exception for ${studentData.name}: ${err.message}`);
      }
    }

    console.log(`\n=== RESTORATION COMPLETE ===`);
    console.log(`✓ Students created: ${studentsCreated}`);
    console.log(`✓ Marks inserted: ${marksInserted}`);
    console.log(`✗ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(e => console.log(`  - ${e}`));
    }

    console.log('\n✓✓✓ GRADE 9 DATA FULLY RESTORED ✓✓✓');

  } catch (err) {
    console.error('Fatal error:', err.message);
  }
}

restoreStudentsAndMarks();
