#!/bin/bash

# This script adds the phone_number column to teacher_accounts table in Supabase
# Run this from the project directory: bash scripts/setup-phone-number.sh

echo "Setting up phone_number column in Supabase..."

# Use psql to connect to Supabase and run the migration
psql $POSTGRES_URL -f scripts/add-phone-number-column.sql

echo "✓ Migration complete!"
echo "Phone number feature is now enabled."
