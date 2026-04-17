import { NextResponse } from "next/server"
import bcryptjs from "bcryptjs"
import { getServerSupabase } from "@/lib/supabase"

export async function POST() {
  try {
    // Use service role key to bypass RLS
    const supabase = getServerSupabase()

    // Generate proper bcryptjs hash for "ghana@1"
    const password = "ghana@1"
    const hash = await bcryptjs.hash(password, 10)

    console.log("[v0] Generated hash for ghana@1:", hash.substring(0, 20))

    // Get all active approved users
    const { data: users, error: fetchError } = await supabase
      .from("profiles")
      .select("username, id")
      .eq("status", "approved")
      .eq("is_active", true)

    if (fetchError) {
      console.error("[v0] Error fetching users:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    console.log("[v0] Found users to update:", users?.length)

    // Update each user's password
    const updates = []
    for (const user of users || []) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          password_hash: hash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (updateError) {
        console.error("[v0] Error updating user:", user.username, updateError)
        updates.push({ username: user.username, success: false, error: updateError.message })
      } else {
        console.log("[v0] Updated user:", user.username)
        updates.push({ username: user.username, success: true })
      }
    }

    // Verify one user's password
    const testUser = users?.[0]
    if (testUser) {
      const { data: verifyData } = await supabase
        .from("profiles")
        .select("username, password_hash")
        .eq("id", testUser.id)
        .single()

      if (verifyData) {
        const isValid = await bcryptjs.compare(password, verifyData.password_hash)
        console.log("[v0] Password verification test for", verifyData.username, ":", isValid)
      }
    }

    return NextResponse.json({
      message: "All passwords reset to: ghana@1",
      totalUsers: users?.length || 0,
      updates,
      hashPreview: hash.substring(0, 20),
    })
  } catch (error: any) {
    console.error("[v0] Reset all passwords error:", error)
    return NextResponse.json({ error: error.message || "Failed to reset passwords" }, { status: 500 })
  }
}
