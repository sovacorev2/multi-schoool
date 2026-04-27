import { neon } from '@neondatabase/serverless'
import fs from 'fs'

async function setupNeonDatabase() {
  const sql = neon(process.env.NEON_POSTGRES_URL)

  try {
    console.log('[NEON] Starting database setup...')
    console.log('[NEON] Connected to Neon database')

    // Drop existing tables
    console.log('[NEON] Dropping existing tables...')
    const tablesToDrop = [
      'marks',
      'audit_logs',
      'sessions',
      'subjects',
      'learners',
      'streams',
      'exam_types',
      'classes',
      'admin_settings'
    ]

    for (const table of tablesToDrop) {
      try {
        await sql(`DROP TABLE IF EXISTS ${table} CASCADE`)
        console.log(`  ✓ Dropped ${table}`)
      } catch (err) {
        console.log(`  ⚠ ${table} not found (ok)`)
      }
    }

    // Create tables
    console.log('\n[NEON] Creating tables...')

    await sql(`
      CREATE TABLE classes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        code text UNIQUE NOT NULL,
        display_order integer DEFAULT 0,
        teacher_name text,
        password text,
        created_at timestamptz DEFAULT now()
      )
    `)
    console.log('  ✓ Created classes')

    await sql(`
      CREATE TABLE exam_types (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text UNIQUE NOT NULL,
        description text,
        display_order integer DEFAULT 0,
        created_at timestamptz DEFAULT now()
      )
    `)
    console.log('  ✓ Created exam_types')

    await client.query(`
      CREATE TABLE streams (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamptz DEFAULT now(),
        UNIQUE(class_id, name)
      )
    `)
    console.log('  ✓ Created streams')

    await client.query(`
      CREATE TABLE learners (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name text NOT NULL,
        admission_number text,
        gender text CHECK (gender IN ('Male', 'Female', 'M', 'F')),
        stream_id uuid REFERENCES streams(id),
        created_at timestamptz DEFAULT now()
      )
    `)
    console.log('  ✓ Created learners')

    await client.query(`
      CREATE TABLE subjects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name text NOT NULL,
        is_custom boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        UNIQUE(class_id, name)
      )
    `)
    console.log('  ✓ Created subjects')

    await client.query(`
      CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        exam_type_id uuid REFERENCES exam_types(id),
        year integer NOT NULL,
        term text NOT NULL,
        is_active boolean DEFAULT true,
        is_locked boolean DEFAULT false,
        deadline_datetime timestamptz,
        locked_at timestamptz,
        locked_by text,
        created_at timestamptz DEFAULT now(),
        UNIQUE(class_id, exam_type_id, year, term)
      )
    `)
    console.log('  ✓ Created sessions')

    await client.query(`
      CREATE TABLE marks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
        year integer NOT NULL,
        term text NOT NULL,
        score numeric CHECK (score >= 0 AND score <= 100),
        exam_type_id uuid REFERENCES exam_types(id),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `)
    console.log('  ✓ Created marks')

    await client.query(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id uuid REFERENCES classes(id),
        session_id uuid REFERENCES sessions(id),
        action text NOT NULL,
        details jsonb,
        performed_by text,
        created_at timestamptz DEFAULT now()
      )
    `)
    console.log('  ✓ Created audit_logs')

    await client.query(`
      CREATE TABLE admin_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text UNIQUE NOT NULL,
        value text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `)
    console.log('  ✓ Created admin_settings')

    // Insert data
    console.log('\n[NEON] Inserting seed data...')

    await client.query(`
      INSERT INTO exam_types (name, description, display_order) VALUES
        ('Opener', 'Opening exam at the start of term', 1),
        ('Midterm', 'Mid-term examination', 2),
        ('Endterm', 'End of term examination', 3)
    `)
    console.log('  ✓ Inserted exam types (3)')

    await client.query(`
      INSERT INTO classes (name, code, display_order) VALUES
        ('PP1', 'PP1', 1),
        ('PP2', 'PP2', 2),
        ('Grade 1', 'GRD1', 3),
        ('Grade 2', 'GRD2', 4),
        ('Grade 3', 'GRD3', 5),
        ('Grade 4', 'GRD4', 6),
        ('Grade 5', 'GRD5', 7),
        ('Grade 6', 'GRD6', 8),
        ('Grade 7', 'GRD7', 9),
        ('Grade 8', 'GRD8', 10),
        ('Grade 9', 'GRD9', 11)
    `)
    console.log('  ✓ Inserted classes (11)')

    await client.query(`
      INSERT INTO admin_settings (key, value) VALUES
        ('admin_password', 'admin123')
    `)
    console.log('  ✓ Inserted admin settings')

    // Verify
    console.log('\n[NEON] Verifying setup...')
    const examTypes = await client.query(`SELECT COUNT(*) as count FROM exam_types`)
    const classes = await client.query(`SELECT COUNT(*) as count FROM classes`)
    const adminSettings = await client.query(`SELECT COUNT(*) as count FROM admin_settings`)

    console.log(`  ✓ Exam types: ${examTypes.rows[0].count}`)
    console.log(`  ✓ Classes: ${classes.rows[0].count}`)
    console.log(`  ✓ Admin settings: ${adminSettings.rows[0].count}`)

    console.log('\n✅ NEON DATABASE SETUP COMPLETE!')
    console.log('\nAll tables created and seed data inserted successfully.')

  } catch (error) {
    console.error('❌ Error setting up Neon database:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

setupNeonDatabase()
