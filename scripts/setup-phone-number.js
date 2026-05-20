const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ Missing POSTGRES_URL environment variable');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('📦 Connecting to database...');
    const client = await pool.connect();
    
    console.log('📝 Adding phone_number column to teacher_accounts...');
    
    const sql = `
      ALTER TABLE teacher_accounts
      ADD COLUMN IF NOT EXISTS phone_number TEXT;
    `;
    
    await client.query(sql);
    
    console.log('✓ Column added successfully!');
    
    // Verify the column exists
    const verifyResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='teacher_accounts' AND column_name='phone_number'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✓ Verified: phone_number column exists in teacher_accounts table');
    }
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Migration complete! Phone number feature is now enabled.');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
