import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function normalizeValue(value: string | null | undefined) {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export async function POST() {
  try {
    const supabaseAdmin = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const [{ data: heads, error: headsError }, { data: allProfiles, error: profilesError }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, department, location, role, is_active, status")
        .eq("role", "department_head")
        .or("is_active.eq.true,status.eq.approved")
        .order("full_name"),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, department, location, role, is_active, status")
        .or("is_active.eq.true,status.eq.approved")
        .order("full_name"),
    ])

    if (headsError) throw headsError
    if (profilesError) throw profilesError

    const excludedRoles = new Set(["admin", "it_head", "regional_it_head", "service_provider", "department_head"])
    const eligibleUsers = (allProfiles || []).filter((profile: any) => !excludedRoles.has(profile.role))

    const headGroups = new Map<string, any[]>()
    for (const head of heads || []) {
      const key = `${normalizeValue(head.department)}::${normalizeValue(head.location)}`
      const group = headGroups.get(key) || []
      group.push(head)
      headGroups.set(key, group)
    }

    const ambiguousGroups = Array.from(headGroups.entries()).filter(([, group]) => group.length > 1)
    const ambiguousHeadIds = new Set(ambiguousGroups.flatMap(([, group]) => group.map((head: any) => head.id)))

    const linksToInsert: { department_head_id: string; staff_id: string; created_at: string }[] = []
    const matchedStaffIds = new Set<string>()
    const summary: { headId: string; headName: string; department: string; location: string; linkedCount: number; skipped?: string }[] = []

    for (const head of heads || []) {
      if (ambiguousHeadIds.has(head.id)) {
        summary.push({
          headId: head.id,
          headName: head.full_name,
          department: head.department,
          location: head.location,
          linkedCount: 0,
          skipped: "Multiple department heads share this department and location",
        })
        continue
      }

      const targetDepartment = normalizeValue(head.department)
      const targetLocation = normalizeValue(head.location)
      const matchedUsers = eligibleUsers.filter((user: any) => {
        return (
          normalizeValue(user.department) === targetDepartment &&
          normalizeValue(user.location) === targetLocation
        )
      })

      for (const user of matchedUsers) {
        matchedStaffIds.add(user.id)
        linksToInsert.push({
          department_head_id: head.id,
          staff_id: user.id,
          created_at: new Date().toISOString(),
        })
      }

      summary.push({
        headId: head.id,
        headName: head.full_name,
        department: head.department,
        location: head.location,
        linkedCount: matchedUsers.length,
      })
    }

    if (matchedStaffIds.size > 0) {
      await supabaseAdmin
        .from("department_head_links")
        .delete()
        .in("staff_id", Array.from(matchedStaffIds))

      if (linksToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from("department_head_links")
          .insert(linksToInsert)

        if (insertError) throw insertError
      }
    }

    return NextResponse.json({
      success: true,
      linked_count: linksToInsert.length,
      heads_processed: (heads || []).length,
      ambiguous_groups: ambiguousGroups.map(([key, group]) => ({
        key,
        heads: group.map((head: any) => ({ id: head.id, name: head.full_name, department: head.department, location: head.location })),
      })),
      summary,
      message: `Automatically linked ${linksToInsert.length} user(s) across ${(heads || []).length} department head profile(s).`,
    })
  } catch (error) {
    console.error("[department-heads] Error auto-linking all staff:", error)
    return NextResponse.json({ error: "Failed to auto-link all department staff" }, { status: 500 })
  }
}