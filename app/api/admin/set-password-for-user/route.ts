import { type NextRequest, NextResponse } from "next/server"
import bcryptjs from "bcryptjs"
import { getServerSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 })
    }

    // Generate REAL bcryptjs hash
    const salt = await bcryptjs.genSalt(10)
    const passwordHash = await bcryptjs.hash(password, salt)

    console.log("[v0] Generated hash for password:", password)
    console.log("[v0] Hash preview:", passwordHash.substring(0, 20))

    // Verify the hash works BEFORE setting it
    const verificationTest = await bcryptjs.compare(password, passwordHash)
    console.log("[v0] Pre-verification test:", verificationTest)

    if (!verificationTest) {
      return NextResponse.json({ error: "Hash generation failed verification" }, { status: 500 })
    }

    // Use service role key to bypass RLS
    // Already initialized at top of function

    // Update the password
    const { data, error } = await supabase
      .from("profiles")
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("username", username)
      .select("username, role")

    if (error) {
      console.error("[v0] Database update error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Verify it was saved correctly
    const { data: checkData } = await supabase
      .from("profiles")
      .select("username, password_hash")
      .eq("username", username)
      .single()

    if (checkData) {
      const finalVerification = await bcryptjs.compare(password, checkData.password_hash)
      console.log("[v0] Final verification after DB save:", finalVerification)
      console.log("[v0] Hash in DB:", checkData.password_hash.substring(0, 20))

      return NextResponse.json({
        success: true,
        message: `Password set for ${username}`,
        password: password,
        hashPreview: passwordHash.substring(0, 20),
        verificationWorks: finalVerification,
      })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("[v0] Set password error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
