"use server"

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  
  // Check if admin_settings table exists by trying to query it
  const { error: checkError } = await supabase
    .from("admin_settings")
    .select("id")
    .limit(1)
  
  if (checkError && checkError.code === "42P01") {
    // Table doesn't exist - we'll use a simple approach with environment variables
    // For now, admin password will be stored in env
  }
  
  return NextResponse.json({ success: true })
}
