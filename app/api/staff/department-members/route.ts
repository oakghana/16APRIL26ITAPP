import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, department")
      .eq("id", userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Prefer explicit linking table for department-head scope.
    const { data: links, error: linksError } = await supabaseAdmin
      .from("department_head_links")
      .select("staff_id")
      .eq("department_head_id", profile.id)

    if (linksError) {
      console.error("[v0] Error fetching linked staff IDs:", linksError)
      return NextResponse.json({ success: true, staff: [] })
    }

    if (!links || links.length === 0) {
      return NextResponse.json({ success: true, staff: [] })
    }

    const staffIds = links.map((link: any) => link.staff_id).filter(Boolean)

    if (staffIds.length === 0) {
      return NextResponse.json({ success: true, staff: [] })
    }

    const { data: staff, error: staffError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, username, department, role, is_approved, is_active, created_at")
      .in("id", staffIds)
      .order("full_name")

    if (staffError) {
      console.error("[v0] Error fetching staff details:", staffError)
      return NextResponse.json({ success: true, staff: [] })
    }

    return NextResponse.json({ success: true, staff: staff || [] })
  } catch (error) {
    console.error("[v0] Error fetching department members:", error)
    return NextResponse.json(
      { error: "Failed to fetch department members" },
      { status: 500 }
    )
  }
}
