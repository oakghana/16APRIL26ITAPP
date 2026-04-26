import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, fullName, password, phone, department, location } = body

    console.log("[v0] Registration request:", { username, email, fullName, location })

    // Validate required fields
    if (!username || !email || !fullName || !location) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: existingUser, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle()

    if (checkError) {
      console.error("[v0] Error checking existing user:", checkError)
    }

    if (existingUser) {
      console.log("[v0] User already exists")
      return NextResponse.json({ message: "Username or email already exists" }, { status: 409 })
    }

    // Default password for self-registered users
    const defaultPassword = "password"
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)

    console.log("[v0] Creating new user profile with default password policy")

    const { data: newUser, error } = await supabase
      .from("profiles")
      .insert([
        {
          username,
          email,
          full_name: fullName,
          phone: phone || null,
          department: department || "General",
          location,
          password_hash: hashedPassword,
          role: "user",
          status: "approved",
          is_active: true,
          must_change_password: true,
          password_changed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("[v0] Registration error:", error)
      return NextResponse.json({ message: "Registration failed. Please try again." }, { status: 500 })
    }

    console.log("[v0] User registered successfully:", newUser.id)

    return NextResponse.json(
      {
        message: "Registration successful. Your default password is: password. Please change it after first login.",
        userId: newUser.id,
        defaultPassword,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Registration error:", error)
    return NextResponse.json({ message: "An error occurred during registration" }, { status: 500 })
  }
}
