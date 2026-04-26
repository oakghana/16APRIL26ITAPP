import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

// Use service role key to bypass RLS policies
const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key"))

export async function POST(request: NextRequest) {
  try {
    const { username, newPassword } = await request.json()

    console.log("[v0] Change password request for:", username)

    if (!username || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 })
    }

    // Verify user exists and is active
    const { data: userData, error: fetchError } = await supabase
      .from("profiles")
      .select("status, is_active")
      .eq("username", username)
      .single()

    if (fetchError || !userData) {
      console.error("[v0] User fetch error:", fetchError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (userData.status !== "approved" || !userData.is_active) {
      return NextResponse.json({ error: "Account is not active" }, { status: 403 })
    }

    const newPasswordHash = await bcrypt.hash(String(newPassword), 10)

    console.log("[v0] Generated new hash starting with:", newPasswordHash.substring(0, 10))

    // Use raw SQL execution to ensure the update persists
    const { data, error: updateError } = await supabase.rpc("exec_sql", {
      sql: `UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE username = $2 RETURNING username`,
      params: [newPasswordHash, username],
    })

    // After RPC success, also clear the force-change flag
    if (!updateError) {
      await supabase
        .from("profiles")
        .update({
          must_change_password: false,
          password_changed_at: new Date().toISOString(),
        })
        .eq("username", username)
    }

    // If RPC doesn't exist, try direct update with explicit column targeting
    if (updateError) {
      console.log("[v0] RPC failed, trying direct update:", updateError.message)

      const { error: directUpdateError } = await supabase
        .from("profiles")
        .update({
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString(),
        })
        .eq("username", username)
        .select()

      if (!directUpdateError) {
        // Clear the force-change flag and record when password was changed
        await supabase
          .from("profiles")
          .update({
            must_change_password: false,
            password_changed_at: new Date().toISOString(),
          })
          .eq("username", username)
      }

      if (directUpdateError) {
        console.error("[v0] Password update error:", directUpdateError)
        return NextResponse.json({ error: "Failed to update password. Please contact administrator." }, { status: 500 })
      }
    }

    console.log("[v0] Password successfully updated for:", username)

    // Verify the update worked
    const { data: verifyData } = await supabase
      .from("profiles")
      .select("password_hash")
      .eq("username", username)
      .single()

    console.log("[v0] Verification - new hash starts with:", verifyData?.password_hash?.substring(0, 10))

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("[v0] Change password error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
