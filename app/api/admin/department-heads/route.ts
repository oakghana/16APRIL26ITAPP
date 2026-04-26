import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function normalizeValue(value: string | null | undefined) {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locationFilter = normalizeValue(searchParams.get("location") || "")

    const [{ data: heads, error: headsError }, { data: allProfiles, error: profilesError }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, department, location, role, is_active, status")
        .eq("role", "department_head")
        .or("is_active.eq.true,status.eq.approved"),
      supabaseAdmin
        .from("profiles")
        .select("id, department, location, role, is_active, status")
        .or("is_active.eq.true,status.eq.approved"),
    ])

    if (headsError) throw headsError
    if (profilesError) throw profilesError

    const excludedRoles = new Set(["admin", "it_head", "regional_it_head", "service_provider", "department_head"])
    const allEligible = (allProfiles || []).filter((profile: any) => !excludedRoles.has(profile.role))

    // Filter heads by location if restricted
    const filteredHeads = locationFilter
      ? (heads || []).filter((h: any) => normalizeValue(h.location) === locationFilter)
      : (heads || [])

    // For staff counts, also scope to location if restricted
    const eligibleUsers = locationFilter
      ? allEligible.filter((p: any) => normalizeValue(p.location) === locationFilter)
      : allEligible

    const headsWithCounts = filteredHeads.map((head: any) => {
      const targetDepartment = normalizeValue(head.department)
      const targetLocation = normalizeValue(head.location)
      const matchedUsers = eligibleUsers.filter((profile: any) => {
        return (
          normalizeValue(profile.department) === targetDepartment &&
          normalizeValue(profile.location) === targetLocation
        )
      })

      return {
        id: head.id,
        name: head.full_name,
        email: head.email,
        department: head.department,
        location: head.location,
        staff_count: matchedUsers.length,
      }
    })

    return NextResponse.json({ department_heads: headsWithCounts })
  } catch (error) {
    console.error("[v0] Error fetching department heads:", error)
    return NextResponse.json(
      { error: "Failed to fetch department heads" },
      { status: 500 }
    )
  }
}
