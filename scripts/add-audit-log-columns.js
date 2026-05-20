import { Pool } from 'pg'

async function runMigration() {
  const connectionString = process.env.POSTGRES_URL

  if (!connectionString) {
    console.error('POSTGRES_URL environment variable not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })

  try {
    const client = await pool.connect()
    console.log('Connected to database')

    // Execute migration
    await client.query(`
      ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS teacher_pin TEXT;
      ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS class_id TEXT;
      
      CREATE INDEX IF NOT EXISTS idx_activity_logs_teacher_pin ON activity_logs(teacher_pin);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_class_id ON activity_logs(class_id);
    `)

    console.log('✓ Migration completed successfully')
    console.log('✓ Added teacher_pin column')
    console.log('✓ Added class_id column')
    console.log('✓ Created indexes for faster queries')

    client.release()
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigration()
