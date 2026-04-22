import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function GET() {
  try {
    // Get ALL profiles except pure admin/IT management roles
    // Use exclusion so any role not in this list is still included
    const { data: allProfiles, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, department, location, role, is_active, status")
      .or("is_active.eq.true,status.eq.approved")
      .order("full_name")

    // Exclude roles that should not be assigned to a department head
    const excludedRoles = new Set(["admin", "it_head", "regional_it_head", "service_provider"])

    if (fetchError) throw fetchError
    const staff = (allProfiles || []).filter((u: any) => !excludedRoles.has(u.role))

    // Fetch all department_head_links in one query
    const staffIds = staff.map((u: any) => u.id)
    const { data: links } = staffIds.length
      ? await supabaseAdmin
          .from("department_head_links")
          .select("staff_id, department_head_id")
          .in("staff_id", staffIds)
      : { data: [] }

    const linkMap = new Map((links || []).map((l: any) => [l.staff_id, l.department_head_id]))

    const staffWithLinking = staff.map((member: any) => ({
      id: member.id,
      name: member.full_name,
      email: member.email,
      department: member.department,
      location: member.location,
      role: member.role,
      linked: linkMap.has(member.id),
      department_head_id: linkMap.get(member.id) || null,
    }))

    return NextResponse.json({ staff: staffWithLinking })
  } catch (error) {
    console.error("[v0] Error fetching staff list:", error)
    return NextResponse.json(
      { error: "Failed to fetch staff list" },
      { status: 500 }
    )
  }
}
