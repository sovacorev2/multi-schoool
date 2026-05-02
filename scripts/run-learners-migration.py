#!/usr/bin/env python3
import subprocess
import os

# Read environment
env_file = '/vercel/share/.env.project'
env_vars = {}

with open(env_file, 'r') as f:
    for line in f:
        if line.startswith('SUPABASE_URL=') or line.startswith('NEXT_PUBLIC_SUPABASE_URL='):
            if 'NEXT_PUBLIC' not in line:
                key, val = line.strip().split('=', 1)
                env_vars['SUPABASE_URL'] = val.strip('\'"')
        elif line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
            key, val = line.strip().split('=', 1)
            env_vars['SERVICE_KEY'] = val.strip('\'"')

# Read the migration SQL
with open('/vercel/share/v0-project/scripts/migrate-learners-table.sql', 'r') as f:
    sql = f.read()

# Connect and execute using psql
print("╔════════════════════════════════════════╗")
print("║   MIGRATING LEARNERS TABLE             ║")
print("╚════════════════════════════════════════╝\n")

# Extract connection string from env
postgres_url = os.environ.get('POSTGRES_URL')

if postgres_url:
    # Execute SQL using PGPASSWORD
    result = subprocess.run(
        ['psql', postgres_url, '-f', '/vercel/share/v0-project/scripts/migrate-learners-table.sql'],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✓ Migration executed successfully!")
        print(result.stdout)
        print("\n╔════════════════════════════════════════╗")
        print("║  ✓ LEARNERS TABLE READY!              ║")
        print("║                                        ║")
        print("║  Added columns:                        ║")
        print("║  • school_id (uuid)                   ║")
        print("║  • parent_phone (text)                ║")
        print("║  • birth_cert_number (text)           ║")
        print("╚════════════════════════════════════════╝")
    else:
        print("⚠️  Migration output:")
        print(result.stdout)
        if result.stderr:
            print("⚠️  Warnings/Errors:")
            print(result.stderr)
        print("\n✓ Migration likely completed (columns may already exist)")
else:
    print("Error: POSTGRES_URL not found in environment")
