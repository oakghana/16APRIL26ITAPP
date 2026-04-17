import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
      persistSession: false,
    },
  }
)

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword } = await request.json()

    console.log("[v0] Force password reset for:", email)

    // Generate a fresh bcrypt hash using the same library as login
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    console.log("[v0] Generated hash:", hashedPassword.substring(0, 20))

    // Test the hash immediately to ensure it works
    const testResult = await bcrypt.compare(newPassword, hashedPassword)
    console.log("[v0] Hash verification test:", testResult)

    if (!testResult) {
      return NextResponse.json(
        { error: "Hash generation failed verification" },
        { status: 500 }
      )
    }

    // Update the user's password in the database
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq("email", email)
      .select()

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!updateResult || updateResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[v0] Password updated successfully for:", email)

    return NextResponse.json({
      success: true,
      message: `Password for ${email} has been reset to ${newPassword}`,
      user: {
        email: updateResult[0].email,
        username: updateResult[0].username,
        full_name: updateResult[0].full_name,
      },
      hashVerified: testResult,
    })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Force reset password endpoint. POST with { email, newPassword }",
  })
}
