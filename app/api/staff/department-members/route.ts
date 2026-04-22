import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function GET(request: NextRequest) {
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a department head
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, department")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // If user is a department head, get staff linked to them
    if (profile.role === "department_head") {
      // Get all staff linked to this department head via department_head_links
      const { data: links, error: linksError } = await supabaseAdmin
        .from("department_head_links")
        .select("staff_id")
        .eq("department_head_id", profile.id)

      if (linksError) {
        console.error("[v0] Error fetching linked staff IDs:", linksError)
        return NextResponse.json({ staff: [] })
      }

      if (!links || links.length === 0) {
        return NextResponse.json({ success: true, staff: [] })
      }

      const staffIds = links.map((link: any) => link.staff_id)

      // Get full staff details
      const { data: staff, error: staffError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, username, department, role, is_approved, is_active, created_at")
        .in("id", staffIds)
        .order("full_name")

      if (staffError) {
        console.error("[v0] Error fetching staff details:", staffError)
        return NextResponse.json({ staff: [] })
      }

      return NextResponse.json({ success: true, staff: staff || [] })
    }

    // Otherwise, return empty list (only department heads should use this)
    return NextResponse.json({ success: true, staff: [] })
  } catch (error) {
    console.error("[v0] Error fetching department members:", error)
    return NextResponse.json(
      { error: "Failed to fetch department members" },
      { status: 500 }
    )
  }
}
