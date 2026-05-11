const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Manually extracted data from the marklist HTML
const grade9Data = [
  { name: 'IVINE CONSOLATA', stream: 'WEST', marks: { 'ENGLISH': 77, 'KISWAHILI': 87, 'MATHS': 75, 'INTEGRATED SCIENCE': 68, 'CHRISTIAN RELIGIOUS EDUCATION': 78, 'PRACTICAL TECHNOLOGY': 82, 'AGRICULTURE': 91, 'SOCIAL STUDIES': 80, 'COMMUNITY SERVICE': 79 } },
  { name: 'JOSHUA PRECIOUS', stream: 'WEST', marks: { 'ENGLISH': 71, 'KISWAHILI': 79, 'MATHS': 93, 'INTEGRATED SCIENCE': 68, 'CHRISTIAN RELIGIOUS EDUCATION': 60, 'PRACTICAL TECHNOLOGY': 90, 'AGRICULTURE': 81, 'SOCIAL STUDIES': 72, 'COMMUNITY SERVICE': 84 } },
  { name: 'LUCY NYOLE', stream: 'WEST', marks: { 'ENGLISH': 78, 'KISWAHILI': 84, 'MATHS': 80, 'INTEGRATED SCIENCE': 64, 'CHRISTIAN RELIGIOUS EDUCATION': 60, 'PRACTICAL TECHNOLOGY': 86, 'AGRICULTURE': 72, 'SOCIAL STUDIES': 76, 'COMMUNITY SERVICE': 81 } },
  { name: 'SHANNEL AMASE', stream: 'WEST', marks: { 'ENGLISH': 75, 'KISWAHILI': 85, 'MATHS': 77, 'INTEGRATED SCIENCE': 63, 'CHRISTIAN RELIGIOUS EDUCATION': 64, 'PRACTICAL TECHNOLOGY': 86, 'AGRICULTURE': 79, 'SOCIAL STUDIES': 76, 'COMMUNITY SERVICE': 72 } },
  { name: 'ALVIS KAKAI', stream: 'WEST', marks: { 'ENGLISH': 80, 'KISWAHILI': 86, 'MATHS': 62, 'INTEGRATED SCIENCE': 63, 'CHRISTIAN RELIGIOUS EDUCATION': 71, 'PRACTICAL TECHNOLOGY': 80, 'AGRICULTURE': 75, 'SOCIAL STUDIES': 70, 'COMMUNITY SERVICE': 71 } },
  { name: 'CLAYTON OKILIPA STARFORD', stream: 'WEST', marks: { 'ENGLISH': 70, 'KISWAHILI': 77, 'MATHS': 69, 'INTEGRATED SCIENCE': 65, 'CHRISTIAN RELIGIOUS EDUCATION': 71, 'PRACTICAL TECHNOLOGY': 79, 'AGRICULTURE': 70, 'SOCIAL STUDIES': 74, 'COMMUNITY SERVICE': 77 } },
  { name: 'ANGEL CASMIR', stream: 'WEST', marks: { 'ENGLISH': 76, 'KISWAHILI': 72, 'MATHS': 51, 'INTEGRATED SCIENCE': 66, 'CHRISTIAN RELIGIOUS EDUCATION': 60, 'PRACTICAL TECHNOLOGY': 86, 'AGRICULTURE': 67, 'SOCIAL STUDIES': 78, 'COMMUNITY SERVICE': 82 } },
  { name: 'Raymond Odhiambi', stream: 'EAST', marks: { 'ENGLISH': 74, 'KISWAHILI': 78, 'MATHS': 70, 'INTEGRATED SCIENCE': 73, 'CHRISTIAN RELIGIOUS EDUCATION': 92, 'PRACTICAL TECHNOLOGY': 76, 'AGRICULTURE': 85, 'SOCIAL STUDIES': 87 } },
  { name: 'CHRISPINE MAGARA', stream: 'WEST', marks: { 'ENGLISH': 66, 'KISWAHILI': 74, 'MATHS': 60, 'INTEGRATED SCIENCE': 59, 'CHRISTIAN RELIGIOUS EDUCATION': 51, 'PRACTICAL TECHNOLOGY': 86, 'AGRICULTURE': 77, 'SOCIAL STUDIES': 70, 'COMMUNITY SERVICE': 76 } },
  { name: 'LAURAH NEKESA', stream: 'WEST', marks: { 'ENGLISH': 76, 'KISWAHILI': 72, 'MATHS': 57, 'INTEGRATED SCIENCE': 55, 'CHRISTIAN RELIGIOUS EDUCATION': 59, 'PRACTICAL TECHNOLOGY': 70, 'AGRICULTURE': 80, 'SOCIAL STUDIES': 80, 'COMMUNITY SERVICE': 68 } },
];

async function restoreMarklist() {
  try {
    console.log('=== GRADE 9 MARKLIST RESTORATION ===\n');

    // Get Amagoro school
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('code', 'amagoro')
      .single();

    if (!school) {
      console.log('✗ Amagoro school not found');
      return;
    }

    console.log(`✓ Found Amagoro school (ID: ${school.id})`);

    // Get Grade 9 class
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', school.id)
      .like('name', '%Grade 9%');

    if (!classes || classes.length === 0) {
      console.log('✗ No Grade 9 classes found');
      return;
    }

    const grade9ClassId = classes[0].id;
    console.log(`✓ Found Grade 9 class: ${classes[0].name}`);

    // Get Term 2 2026 session
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, year, term')
      .eq('school_id', school.id)
      .eq('year', 2026);

    const session = sessions?.find(s => s.term === 'Term 2' || s.term === 2);
    if (!session) {
      console.log('✗ No Term 2 2026 session found');
      return;
    }

    console.log(`✓ Found session: Term ${session.term}, Year ${session.year}`);

    let studentsCreated = 0;
    let marksInserted = 0;
    const errors = [];

    // Process each student
    for (const student of grade9Data) {
      try {
        console.log(`\nProcessing: ${student.name}`);

        // Check if student already exists
        const { data: existing } = await supabase
          .from('students')
          .select('id')
          .eq('school_id', school.id)
          .ilike('name', student.name)
          .limit(1);

        let studentId;

        if (existing && existing.length > 0) {
          studentId = existing[0].id;
          console.log(`  ✓ Student exists`);
        } else {
          // Create new student
          const { data: newStudent, error: createErr } = await supabase
            .from('students')
            .insert({
              name: student.name,
              school_id: school.id,
              class_id: grade9ClassId
            })
            .select();

          if (createErr) {
            errors.push(`Failed to create ${student.name}: ${createErr.message}`);
            console.log(`  ✗ Error: ${createErr.message}`);
            continue;
          }

          studentId = newStudent[0].id;
          studentsCreated++;
          console.log(`  ✓ Student created`);
        }

        // Insert marks
        const marksArray = [];
        for (const [subject, score] of Object.entries(student.marks)) {
          marksArray.push({
            student_id: studentId,
            session_id: session.id,
            school_id: school.id,
            subject: subject,
            score: score
          });
        }

        const { error: marksErr } = await supabase
          .from('marks')
          .insert(marksArray);

        if (marksErr) {
          errors.push(`Failed to insert marks for ${student.name}: ${marksErr.message}`);
          console.log(`  ✗ Marks error: ${marksErr.message}`);
        } else {
          marksInserted += marksArray.length;
          console.log(`  ✓ ${marksArray.length} marks inserted`);
        }

      } catch (err) {
        errors.push(`Error processing ${student.name}: ${err.message}`);
        console.log(`  ✗ Error: ${err.message}`);
      }
    }

    console.log('\n=== RESTORATION COMPLETE ===');
    console.log(`✓ Students created: ${studentsCreated}`);
    console.log(`✓ Marks inserted: ${marksInserted}`);
    console.log(`✗ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(e => console.log(`  - ${e}`));
    }

    console.log('\n✓✓✓ Grade 9 marklist successfully restored! ✓✓✓');

  } catch (err) {
    console.error('Fatal error:', err.message);
  }
}

restoreMarklist();
