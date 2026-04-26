import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // Find the department_head_link for this user
    const { data: link, error: linkError } = await supabaseAdmin
      .from("department_head_links")
      .select("department_head_id")
      .eq("staff_id", userId)
      .maybeSingle()

    if (linkError) throw linkError

    if (!link?.department_head_id) {
      return NextResponse.json({ hod: null })
    }

    // Fetch the department head's profile
    const { data: head, error: headError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, department")
      .eq("id", link.department_head_id)
      .single()

    if (headError || !head) {
      return NextResponse.json({ hod: null })
    }

    return NextResponse.json({
      hod: {
        name: head.full_name,
        email: head.email,
        department: head.department,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching HOD for staff:", error)
    return NextResponse.json({ error: "Failed to fetch department head" }, { status: 500 })
  }
}
