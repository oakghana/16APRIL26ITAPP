import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const { username, password } = await request.json()

    console.log("[v0] Simulating login for:", username)

    // Step 1: Hash the password with bcryptjs
    const hashedPassword = await bcrypt.hash(password, 10)
    console.log("[v0] Generated hash:", hashedPassword.substring(0, 20))

    // Step 2: Update the user's password in the database
    const { data: updateData, error: updateError } = await supabase
      .from("profiles")
      .update({ password_hash: hashedPassword, updated_at: new Date().toISOString() })
      .eq("username", username)
      .select()

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      return NextResponse.json({ error: "Failed to update password", details: updateError }, { status: 500 })
    }

    console.log("[v0] Password updated successfully")

    // Step 3: Fetch the user with the new password
    const { data: userData, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .eq("status", "approved")
      .eq("is_active", true)
      .single()

    if (fetchError || !userData) {
      console.error("[v0] Fetch error:", fetchError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[v0] User fetched:", userData.username)

    // Step 4: Verify the password
    const isValid = await bcrypt.compare(password, userData.password_hash)
    console.log("[v0] Password verification:", isValid)

    if (!isValid) {
      return NextResponse.json({ error: "Password verification failed" }, { status: 401 })
    }

    // Step 5: Create session data
    const sessionData = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      role: userData.role,
      full_name: userData.full_name,
    }

    return NextResponse.json({
      success: true,
      message: "Login simulation successful",
      user: sessionData,
      sessionToken: Buffer.from(JSON.stringify(sessionData)).toString("base64"),
    })
  } catch (error) {
    console.error("[v0] Simulation error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
