import { NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

// Use service role key to bypass RLS
export async function POST(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    console.log("[v0] Login attempt for:", username)

    // Search by username OR email to be flexible
    // First try exact username match, then try email match
    let { data: user, error: queryError } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .eq("status", "approved")
      .eq("is_active", true)
      .maybeSingle()

    // If not found by username, try searching by email
    if (!user && !queryError) {
      console.log("[v0] User not found by username, searching by email:", username)
      const { data: emailUser, error: emailError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", username)
        .eq("status", "approved")
        .eq("is_active", true)
        .maybeSingle()
      
      if (emailError) {
        queryError = emailError
      }
      user = emailUser
    }

    if (queryError) {
      console.error("[v0] Database query error:", queryError)
      await supabase.from("audit_logs").insert({
        username: username,
        action: "LOGIN_FAILED",
        resource: "auth/login",
        details: `Database error during login attempt for ${username}`,
        severity: "high",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
    }

    if (!user) {
      console.log("[v0] No user found for username/email:", username)
      await supabase.from("audit_logs").insert({
        username: username,
        action: "LOGIN_FAILED",
        resource: "auth/login",
        details: `Failed login attempt: User not found or not approved/active`,
        severity: "medium",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    console.log("[v0] User found:", user.username, "role:", user.role)
    console.log("[v0] Hash exists:", !!user.password_hash)
    console.log("[v0] Hash format:", user.password_hash?.substring(0, 10))

    if (!user.password_hash || user.password_hash.length < 20) {
      console.log("[v0] No valid password hash for user:", username)
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        username: username,
        action: "LOGIN_FAILED",
        resource: "auth/login",
        details: `Failed login attempt: Password not set for user`,
        severity: "high",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })
      return NextResponse.json(
        {
          error: "Password not set. Please contact an administrator.",
        },
        { status: 401 },
      )
    }

    console.log("[v0] Attempting password validation for hash format:", user.password_hash.substring(0, 7))
    console.log("[v0] Password length:", password.length)
    console.log("[v0] Hash length:", user.password_hash.length)
    console.log("[v0] Comparing password with hash using bcryptjs...")

    let isPasswordValid = false
    try {
      isPasswordValid = await bcrypt.compare(password, user.password_hash)
    } catch (bcryptError) {
      console.error("[v0] Bcrypt compare error:", bcryptError)
      // If bcrypt fails, try direct comparison as fallback
      console.log("[v0] Attempting fallback: direct password comparison")
      isPasswordValid = password === user.password_hash
    }
    
    console.log("[v0] Password verification result:", isPasswordValid)
    console.log("[v0] Hash starts with:", user.password_hash.substring(0, 10))

    if (!isPasswordValid) {
      console.log("[v0] Password verification failed for:", username)
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        username: username,
        action: "LOGIN_FAILED",
        resource: "auth/login",
        details: `Failed login attempt: Invalid password`,
        severity: "medium",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      username: user.username,
      action: "USER_LOGIN",
      resource: "auth/login",
      details: `Successful login as ${user.role} from ${user.location}`,
      severity: "low",
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    })

    let redirectUrl = "/dashboard"
    if (user.role === "admin") {
      redirectUrl = "/dashboard/admin"
    } else if (user.role === "it_store_head") {
      redirectUrl = "/dashboard/store-inventory"
    } else if (user.role === "it_staff") {
      redirectUrl = "/dashboard/assigned-tasks"
    } else if (user.role === "staff") {
      redirectUrl = "/dashboard/service-desk"
    } else if (user.role === "regional_it_head" || user.role === "it_head") {
      redirectUrl = "/dashboard"
    } else if (user.role?.startsWith("service_desk_")) {
      redirectUrl = "/dashboard/service-desk"
    }

    console.log("[v0] Login successful for:", username, "redirecting to:", redirectUrl)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        location: user.location,
        department: user.department,
      },
      redirectUrl,
    })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
