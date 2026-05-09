const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Manually parse the marklist data
const marksData = [
  { name: 'IVINE CONSOLATA', stream: 'WEST', marks: { AGR_NU: 91, CAS: 79, CRE: 78, ENGLISH: 77, I_SCIENCE: 68, KISWAHILI: 87, MATHS: 75, P_TECH: 82, SST: 80 } },
  { name: 'JOSHUA PRECIOUS', stream: 'WEST', marks: { AGR_NU: 81, CAS: 84, CRE: 60, ENGLISH: 71, I_SCIENCE: 68, KISWAHILI: 79, MATHS: 93, P_TECH: 90, SST: 72 } },
  { name: 'LUCY NYOLE', stream: 'WEST', marks: { AGR_NU: 72, CAS: 81, CRE: 60, ENGLISH: 78, I_SCIENCE: 64, KISWAHILI: 84, MATHS: 80, P_TECH: 86, SST: 76 } },
  { name: 'SHANNEL AMASE', stream: 'WEST', marks: { AGR_NU: 79, CAS: 72, CRE: 64, ENGLISH: 75, I_SCIENCE: 63, KISWAHILI: 85, MATHS: 77, P_TECH: 86, SST: 76 } },
  { name: 'ALVIS KAKAI', stream: 'WEST', marks: { AGR_NU: 75, CAS: 71, CRE: 71, ENGLISH: 80, I_SCIENCE: 63, KISWAHILI: 86, MATHS: 62, P_TECH: 80, SST: 70 } },
  { name: 'CLAYTON OKILIPA STARFORD', stream: 'WEST', marks: { AGR_NU: 70, CAS: 77, CRE: 71, ENGLISH: 70, I_SCIENCE: 65, KISWAHILI: 77, MATHS: 69, P_TECH: 79, SST: 74 } },
  { name: 'ANGEL CASMIR', stream: 'WEST', marks: { AGR_NU: 67, CAS: 82, CRE: 60, ENGLISH: 76, I_SCIENCE: 66, KISWAHILI: 72, MATHS: 51, P_TECH: 86, SST: 78 } },
  { name: 'Raymond Odhiambi', stream: 'EAST', marks: { AGR_NU: 85, CRE: 92, ENGLISH: 74, I_SCIENCE: 73, KISWAHILI: 78, MATHS: 70, P_TECH: 76, SST: 87 } },
  { name: 'CHRISPINE MAGARA', stream: 'WEST', marks: { AGR_NU: 77, CAS: 76, CRE: 51, ENGLISH: 66, I_SCIENCE: 59, KISWAHILI: 74, MATHS: 60, P_TECH: 86, SST: 70 } },
  { name: 'LAURAH NEKESA', stream: 'WEST', marks: { AGR_NU: 80, CAS: 68, CRE: 59, ENGLISH: 76, I_SCIENCE: 55, KISWAHILI: 72, MATHS: 57, P_TECH: 70, SST: 80 } },
];

const subjectMap = {
  'AGR_NU': 'Agriculture/Nutrition',
  'CAS': 'CAS',
  'CRE': 'Christian Religious Education',
  'ENGLISH': 'English',
  'I_SCIENCE': 'Integrated Science',
  'KISWAHILI': 'Kiswahili',
  'MATHS': 'Mathematics',
  'P_TECH': 'Practical Technology',
  'SST': 'Social Studies'
};

async function restoreMarks() {
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

    console.log(`✓ Amagoro school ID: ${school.id}\n`);

    // Get all students in Amagoro
    const { data: students } = await supabase
      .from('students')
      .select('id, name')
      .eq('school_id', school.id);

    console.log(`✓ Found ${students?.length} students in Amagoro\n`);

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

    let totalMarksInserted = 0;
    let studentsProcessed = 0;
    const errors = [];

    // Process each student
    for (const student of marksData) {
      const matchingStudent = students?.find(s => 
        s.name.toUpperCase().includes(student.name.toUpperCase()) ||
        student.name.toUpperCase().includes(s.name.toUpperCase())
      );

      if (!matchingStudent) {
        errors.push(`Student not found: ${student.name}`);
        console.log(`  ⚠ Not found: ${student.name}`);
        continue;
      }

      studentsProcessed++;

      // Build marks array
      const marksToInsert = [];
      for (const [subject, score] of Object.entries(student.marks)) {
        if (score && score > 0) {
          marksToInsert.push({
            student_id: matchingStudent.id,
            session_id: sessionId,
            subject: subjectMap[subject] || subject,
            score: score,
            school_id: school.id
          });
        }
      }

      if (marksToInsert.length > 0) {
        const { error } = await supabase
          .from('marks')
          .insert(marksToInsert);

        if (error) {
          errors.push(`${student.name}: ${error.message}`);
          console.log(`  ✗ ${student.name}: Error - ${error.message}`);
        } else {
          totalMarksInserted += marksToInsert.length;
          console.log(`  ✓ ${student.name}: ${marksToInsert.length} marks inserted`);
        }
      }
    }

    console.log(`\n=== RESTORATION COMPLETE ===`);
    console.log(`✓ Students processed: ${studentsProcessed}`);
    console.log(`✓ Total marks inserted: ${totalMarksInserted}`);
    if (errors.length > 0) {
      console.log(`✗ Errors: ${errors.length}`);
      errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log(`\n✓✓✓ Grade 9 marks successfully restored! ✓✓✓`);

  } catch (err) {
    console.error('Fatal error:', err.message);
  }
}

restoreMarks();
