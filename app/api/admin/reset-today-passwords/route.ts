import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getServerSupabase } from "@/lib/supabase"

export async function POST() {
  try {
    const supabase = getServerSupabase()
    const defaultPassword = "qcc@123"
    const today = new Date().toISOString().split("T")[0]
    
    console.log("[v0] Resetting passwords for users created today:", today)
    
    // Generate bcrypt hash
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)
    console.log("[v0] Generated hash:", hashedPassword)
    
    // Verify the hash works
    const testVerify = await bcrypt.compare(defaultPassword, hashedPassword)
    console.log("[v0] Hash verification test:", testVerify)
    
    if (!testVerify) {
      return NextResponse.json({ error: "Hash generation failed verification" }, { status: 500 })
    }
    
    // Get users created today
    const { data: users, error: fetchError } = await supabase
      .from("profiles")
      .select("id, username, email, full_name")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`)
      .eq("status", "approved")
    
    if (fetchError) {
      console.error("[v0] Error fetching users:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    console.log("[v0] Found", users?.length, "users to update")
    
    // Update all users with the new hash
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`)
      .eq("status", "approved")
    
    if (updateError) {
      console.error("[v0] Error updating passwords:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    
    console.log("[v0] Successfully updated passwords for all users")
    
    return NextResponse.json({
      success: true,
      message: `Successfully reset passwords for ${users?.length} users`,
      usersUpdated: users?.length,
      defaultPassword: defaultPassword,
      hashUsed: hashedPassword
    })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
