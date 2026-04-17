import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const { username, password } = await request.json()

    console.log("[v0] Setting up admin account:", username)

    // Generate bcryptjs hash
    const passwordHash = await bcrypt.hash(password, 10)
    console.log("[v0] Generated bcryptjs hash:", passwordHash.substring(0, 20))

    // Delete existing user if exists
    const { error: deleteError } = await supabase.from("profiles").delete().eq("username", username)

    if (deleteError && deleteError.code !== "PGRST116") {
      console.error("[v0] Delete error:", deleteError)
    }

    // Insert fresh admin user with bcryptjs hash
    const { data: newUser, error: insertError } = await supabase
      .from("profiles")
      .insert({
        username,
        email: username,
        full_name: "Admin User",
        role: "admin",
        status: "approved",
        is_active: true,
        password_hash: passwordHash,
        location: "Accra",
        department: "IT",
        phone: "0000000000",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Insert error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log("[v0] Created admin user successfully")

    // Verify the hash works
    const { data: verifyUser } = await supabase
      .from("profiles")
      .select("username, password_hash, role, status")
      .eq("username", username)
      .single()

    if (verifyUser) {
      const isValid = await bcrypt.compare(password, verifyUser.password_hash)
      console.log("[v0] Password verification test:", isValid)

      return NextResponse.json({
        success: true,
        message: "Admin account created successfully",
        username,
        role: verifyUser.role,
        passwordVerified: isValid,
        instructions: `Login with username: ${username} and password: ${password}`,
      })
    }

    return NextResponse.json({ error: "User created but verification failed" }, { status: 500 })
  } catch (error: any) {
    console.error("[v0] Setup admin error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  // Auto-setup admin on GET request for testing
  try {
    const username = "ohemengappiah@qccgh.com"
    const password = "ghana@1"

    console.log("[v0] Auto-setting up admin account:", username)

    const passwordHash = await bcrypt.hash(password, 10)
    console.log("[v0] Generated hash:", passwordHash.substring(0, 30))

    // Delete existing user
    await supabase.from("profiles").delete().eq("username", username)

    // Insert fresh admin user
    const { data: newUser, error: insertError } = await supabase
      .from("profiles")
      .insert({
        username,
        email: username,
        full_name: "Ohemeng Appiah",
        role: "admin",
        status: "approved",
        is_active: true,
        password_hash: passwordHash,
        location: "Accra",
        department: "IT",
        phone: "0000000000",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Insert error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Verify
    const { data: verifyUser } = await supabase.from("profiles").select("*").eq("username", username).single()

    if (verifyUser) {
      const isValid = await bcrypt.compare(password, verifyUser.password_hash)

      return NextResponse.json({
        success: true,
        message: "Admin account setup complete!",
        username,
        password,
        role: verifyUser.role,
        status: verifyUser.status,
        passwordVerified: isValid,
        hashPreview: verifyUser.password_hash.substring(0, 30),
        instructions: `You can now login with:
        Username: ${username}
        Password: ${password}`,
      })
    }

    return NextResponse.json({ error: "Setup failed" }, { status: 500 })
  } catch (error: any) {
    console.error("[v0] Auto-setup error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
