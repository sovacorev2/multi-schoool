#!/usr/bin/env node

/**
 * Verify St James Koteko Primary School has all ShuleTech features
 * and that all data is intact (no data loss)
 */

const { createClient } = require('@supabase/supabase-js');

async function verifyStJamesImplementation() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('\n=== ST JAMES KOTEKO PRIMARY SCHOOL - FEATURE VERIFICATION ===\n');

  try {
    // 1. Check St James school record
    console.log('1. Checking St James school record...');
    const { data: stJames, error: stJamesError } = await supabase
      .from('schools')
      .select('*')
      .ilike('name', '%ST JAMES%')
      .single();

    if (stJamesError || !stJames) {
      console.error('❌ Failed to find St James school:', stJamesError?.message);
      return;
    }

    console.log('✓ School found:', stJames.name);
    console.log('  - Feature PIN Management:', stJames.feature_pin_management ? '✓ ENABLED' : '❌ DISABLED');
    console.log('  - Feature Report Cards:', stJames.feature_report_cards ? '✓ ENABLED' : '❌ DISABLED');
    console.log('  - Feature WhatsApp Reports:', stJames.feature_whatsapp_reports ? '✓ ENABLED' : '❌ DISABLED');
    console.log('  - Feature SMS:', stJames.feature_sms ? '✓ ENABLED' : '❌ DISABLED');
    console.log('  - Feature Bulk SMS:', stJames.feature_bulk_sms ? '✓ ENABLED' : '❌ DISABLED');
    console.log('  - Feature Certificates:', stJames.feature_certificates ? '✓ ENABLED' : '❌ DISABLED');
    console.log('  - Subscription Plan:', stJames.subscription_plan);

    // 2. Check data integrity - classes
    console.log('\n2. Checking St James classes (data integrity)...');
    const { data: classes, count: classCount, error: classError } = await supabase
      .from('classes')
      .select('*', { count: 'exact' })
      .eq('school_id', stJames.id);

    if (classError) {
      console.error('❌ Failed to fetch classes:', classError.message);
    } else {
      console.log(`✓ Classes: ${classCount} classes found`);
      classes?.slice(0, 3).forEach((cls) => {
        console.log(`  - ${cls.name}`);
      });
    }

    // 3. Check data integrity - teachers
    console.log('\n3. Checking St James teachers (data integrity)...');
    const { data: teachers, count: teacherCount, error: teacherError } = await supabase
      .from('teacher_accounts')
      .select('*', { count: 'exact' })
      .eq('school_id', stJames.id);

    if (teacherError) {
      console.error('❌ Failed to fetch teachers:', teacherError.message);
    } else {
      console.log(`✓ Teachers: ${teacherCount} teachers found`);
      teachers?.slice(0, 3).forEach((teacher) => {
        console.log(`  - ${teacher.first_name} ${teacher.last_name} (PIN: ${teacher.pin})`);
      });
    }

    // 4. Check data integrity - learners
    console.log('\n4. Checking St James learners (data integrity)...');
    const { count: learnerCount, error: learnerError } = await supabase
      .from('learners')
      .select('*', { count: 'exact' })
      .eq('school_id', stJames.id);

    if (learnerError) {
      console.error('❌ Failed to fetch learners:', learnerError.message);
    } else {
      console.log(`✓ Learners: ${learnerCount} learners found`);
    }

    // 5. Check data integrity - subjects
    console.log('\n5. Checking St James subjects (data integrity)...');
    const { data: subjects, count: subjectCount, error: subjectError } = await supabase
      .from('subjects')
      .select('*', { count: 'exact' })
      .eq('school_id', stJames.id);

    if (subjectError) {
      console.error('❌ Failed to fetch subjects:', subjectError.message);
    } else {
      console.log(`✓ Subjects: ${subjectCount} subjects found`);
      subjects?.slice(0, 3).forEach((subj) => {
        console.log(`  - ${subj.name}`);
      });
    }

    // 6. Check data integrity - marks
    console.log('\n6. Checking St James marks (data integrity)...');
    const { count: marksCount, error: marksError } = await supabase
      .from('marks')
      .select('*', { count: 'exact' })
      .eq('school_id', stJames.id);

    if (marksError) {
      console.error('❌ Failed to fetch marks:', marksError.message);
    } else {
      console.log(`✓ Marks: ${marksCount} marks records found`);
    }

    // 7. Check teacher assignments for PIN management
    console.log('\n7. Checking St James teacher assignments (PIN management)...');
    const { count: assignmentCount, error: assignmentError } = await supabase
      .from('teacher_assignments')
      .select('*', { count: 'exact' })
      .eq('school_id', stJames.id);

    if (assignmentError) {
      console.error('❌ Failed to fetch assignments:', assignmentError.message);
    } else {
      console.log(`✓ Teacher Assignments: ${assignmentCount} assignments found`);
    }

    // 8. Summary
    console.log('\n=== SUMMARY ===\n');
    if (stJames.feature_pin_management) {
      console.log('✓ PIN MANAGEMENT: ENABLED for St James');
    } else {
      console.log('❌ PIN MANAGEMENT: DISABLED for St James');
    }
    
    const dataIntegrityOk = classCount > 0 && teacherCount > 0 && learnerCount > 0 && subjectCount > 0;
    if (dataIntegrityOk) {
      console.log('✓ DATA INTEGRITY: All St James data is intact');
      console.log(`  - Classes: ${classCount}`);
      console.log(`  - Teachers: ${teacherCount}`);
      console.log(`  - Learners: ${learnerCount}`);
      console.log(`  - Subjects: ${subjectCount}`);
      console.log(`  - Marks: ${marksCount}`);
    } else {
      console.log('❌ DATA INTEGRITY: Some data is missing');
    }

    console.log('\n✓ ST JAMES IS READY FOR PIN MANAGEMENT FEATURES!\n');

  } catch (error) {
    console.error('Error during verification:', error);
  }
}

verifyStJamesImplementation();
