import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

function normalizeValue(value: string | null | undefined) {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    const { department_head_id, staff_ids, actor_id } = await request.json()

    if (!department_head_id || !staff_ids || staff_ids.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const { data: headProfile, error: headError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, department, location")
      .eq("id", department_head_id)
      .eq("role", "department_head")
      .single()

    if (headError || !headProfile) {
      return NextResponse.json(
        { error: "Selected department head not found" },
        { status: 400 }
      )
    }

    if (actor_id) {
      const { data: actorProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, role, location")
        .eq("id", actor_id)
        .single()

      const restrictedRoles = new Set(["it_staff", "regional_it_head"])
      if (actorProfile?.role && restrictedRoles.has(actorProfile.role)) {
        const actorLocation = normalizeValue(actorProfile.location)
        const headLocation = normalizeValue(headProfile.location)
        if (!actorLocation || actorLocation !== headLocation) {
          return NextResponse.json(
            { error: "You can only manage HOD links within your assigned location" },
            { status: 403 }
          )
        }
      }
    }

    const { data: staffProfiles, error: staffError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, department, location")
      .in("id", staff_ids)

    if (staffError) throw staffError

    const headDept = normalizeValue(headProfile.department)
    const headLocation = normalizeValue(headProfile.location)
    const invalidStaff = (staffProfiles || []).filter((profile: any) => {
      const roleAllowed = ["staff", "user", "it_staff", "regional_it_head"].includes(profile.role)
      const sameDepartment = normalizeValue(profile.department) === headDept
      const sameLocation = normalizeValue(profile.location) === headLocation
      return !roleAllowed || !sameDepartment || !sameLocation
    })

    if (invalidStaff.length > 0) {
      return NextResponse.json(
        { error: "Some selected staff are outside the department/location of this department head" },
        { status: 400 }
      )
    }

    // First remove existing links for these staff members
    await supabaseAdmin
      .from("department_head_links")
      .delete()
      .in("staff_id", staff_ids)

    // Create new links
    const links = staff_ids.map((staff_id: string) => ({
      department_head_id,
      staff_id,
      created_at: new Date().toISOString(),
    }))

    const { error } = await supabaseAdmin
      .from("department_head_links")
      .insert(links)

    if (error) throw error

    console.log("[v0] Successfully linked", staff_ids.length, "staff to department head")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error linking staff:", error)
    return NextResponse.json(
      { error: "Failed to link staff" },
      { status: 500 }
    )
  }
}
