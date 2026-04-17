import { NextResponse } from "next/server"
import bcryptjs from "bcryptjs"
import { getServerSupabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Use service role key
    const supabase = getServerSupabase()

    // Get user
    const { data: user, error } = await supabase
      .from("profiles")
      .select("username, password_hash")
      .eq("username", username)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Test password
    const isValid = await bcryptjs.compare(password, user.password_hash)

    return NextResponse.json({
      username: user.username,
      passwordMatches: isValid,
      hashPreview: user.password_hash.substring(0, 20),
      testedPassword: password,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
