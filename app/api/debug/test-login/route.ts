import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function GET(request: NextRequest) {
  const supabase = getServerSupabase()
  const testUsername = "joseph.asante@qccgh.com"
  const testPassword = "qcc@123"
  
  const logs: string[] = []
  
  logs.push(`[TEST] Starting login test for: ${testUsername}`)
  logs.push(`[TEST] Password to test: ${testPassword}`)
  
  // Step 1: Search by username
  logs.push("\n[STEP 1] Searching by username...")
  const { data: user1, error: error1 } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", testUsername)
    .eq("status", "approved")
    .eq("is_active", true)
    .maybeSingle()
  
  logs.push(`[STEP 1] Username search result: ${user1 ? 'FOUND' : 'NOT FOUND'}`)
  if (error1) logs.push(`[STEP 1] Error: ${JSON.stringify(error1)}`)
  if (user1) {
    logs.push(`[STEP 1] User ID: ${user1.id}`)
    logs.push(`[STEP 1] Username: ${user1.username}`)
    logs.push(`[STEP 1] Email: ${user1.email}`)
    logs.push(`[STEP 1] Role: ${user1.role}`)
    logs.push(`[STEP 1] Status: ${user1.status}`)
    logs.push(`[STEP 1] Active: ${user1.is_active}`)
    logs.push(`[STEP 1] Hash length: ${user1.password_hash?.length || 0}`)
    logs.push(`[STEP 1] Hash prefix: ${user1.password_hash?.substring(0, 10)}`)
  }
  
  // Step 2: Search by email
  logs.push("\n[STEP 2] Searching by email...")
  const { data: user2, error: error2 } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", testUsername)
    .eq("status", "approved")
    .eq("is_active", true)
    .maybeSingle()
  
  logs.push(`[STEP 2] Email search result: ${user2 ? 'FOUND' : 'NOT FOUND'}`)
  if (error2) logs.push(`[STEP 2] Error: ${JSON.stringify(error2)}`)
  if (user2) {
    logs.push(`[STEP 2] User ID: ${user2.id}`)
    logs.push(`[STEP 2] Username: ${user2.username}`)
    logs.push(`[STEP 2] Email: ${user2.email}`)
  }
  
  const user = user1 || user2
  
  if (!user) {
    logs.push("\n[RESULT] ❌ USER NOT FOUND")
    return NextResponse.json({ logs, success: false })
  }
  
  // Step 3: Test bcrypt comparison
  logs.push("\n[STEP 3] Testing password with bcrypt.compare()...")
  logs.push(`[STEP 3] Password: ${testPassword}`)
  logs.push(`[STEP 3] Hash: ${user.password_hash}`)
  
  try {
    const isValid = await bcrypt.compare(testPassword, user.password_hash)
    logs.push(`[STEP 3] bcrypt.compare() result: ${isValid ? '✅ MATCH' : '❌ NO MATCH'}`)
    
    if (!isValid) {
      // Try generating a new hash and updating
      logs.push("\n[STEP 4] Generating fresh hash...")
      const newHash = await bcrypt.hash(testPassword, 10)
      logs.push(`[STEP 4] New hash: ${newHash}`)
      
      // Verify new hash works
      const newHashWorks = await bcrypt.compare(testPassword, newHash)
      logs.push(`[STEP 4] New hash verification: ${newHashWorks ? '✅ WORKS' : '❌ FAILED'}`)
      
      // Update in database
      logs.push("\n[STEP 5] Updating password in database...")
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ password_hash: newHash })
        .eq("id", user.id)
      
      if (updateError) {
        logs.push(`[STEP 5] ❌ Update failed: ${JSON.stringify(updateError)}`)
      } else {
        logs.push(`[STEP 5] ✅ Password updated successfully`)
        logs.push(`[STEP 5] User can now login with password: ${testPassword}`)
      }
    } else {
      logs.push("\n[RESULT] ✅ PASSWORD VERIFIED - Login should work!")
    }
  } catch (err: any) {
    logs.push(`[STEP 3] ❌ bcrypt.compare() threw error: ${err.message}`)
  }
  
  return NextResponse.json({ 
    logs,
    success: true,
    username: user.username,
    email: user.email
  })
}
