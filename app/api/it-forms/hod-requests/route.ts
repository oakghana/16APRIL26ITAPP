/**
 * GET /api/it-forms/hod-requests?hodId=<uuid>
 *
 * Returns all IT form requests (requisitions, new-gadget, maintenance) that
 * belong ONLY to staff members who are linked to this specific department head
 * via the department_head_links table. Department heads should never see
 * requests from staff outside their linked group.
 */
import { NextRequest, NextResponse } from "next/server"
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hodId = searchParams.get("hodId")

    if (!hodId) {
      return NextResponse.json({ error: "hodId is required" }, { status: 400 })
    }

    // Verify the caller is a department_head
    const { data: hodProfile, error: hodErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, department, location")
      .eq("id", hodId)
      .eq("role", "department_head")
      .single()

    if (hodErr || !hodProfile) {
      return NextResponse.json({ error: "Department head not found" }, { status: 403 })
    }

    // Get the IDs of all staff linked to this HOD
    const { data: links, error: linkErr } = await supabaseAdmin
      .from("department_head_links")
      .select("staff_id")
      .eq("department_head_id", hodId)

    if (linkErr) throw linkErr

    if (!links || links.length === 0) {
      return NextResponse.json({
        success: true,
        requisitions: [],
        gadgetRequests: [],
        maintenanceRequests: [],
        linkedStaffCount: 0,
      })
    }

    const linkedStaffIds = links.map((l: any) => l.staff_id)
    const linkedStaffIdSet = new Set(linkedStaffIds)

    // Fetch the emails of those staff so we can match request records
    const { data: staffProfiles, error: staffErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, department, location")
      .in("id", linkedStaffIds)

    if (staffErr) throw staffErr

    const linkedEmails = new Set((staffProfiles || []).map((p: any) => (p.email || "").toLowerCase()))
    const linkedNames = new Set((staffProfiles || []).map((p: any) => (p.full_name || "").toLowerCase()))
    const hodDepartment = normalizeValue(hodProfile.department)
    const hodLocation = normalizeValue(hodProfile.location)

    function matchesLinkedStaff(record: any): boolean {
      const requesterId = record.requested_by_id || record.created_by_id || record.staff_id
      const email = (record.requested_by_email || record.created_by_email || "").toLowerCase()
      const name = (record.requested_by || record.staff_name || record.created_by || "").toLowerCase()
      const department = normalizeValue(record.department || record.department_name)
      const location = normalizeValue(record.location || record.requester_location)

      const sameDepartment = !hodDepartment || !department || department === hodDepartment
      const sameLocation = !hodLocation || !location || location === hodLocation

      if (!sameDepartment || !sameLocation) return false

      if (requesterId && linkedStaffIdSet.has(requesterId)) return true
      // Match by email (most reliable) OR fall back to name match
      if (email && linkedEmails.has(email)) return true
      if (name && linkedNames.has(name)) return true
      return false
    }

    // Fetch all records from each table (we filter in code for accuracy)
    const [reqResult, gadgetResult, maintResult] = await Promise.all([
      supabaseAdmin
        .from("it_equipment_requisitions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("new_gadget_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("maintenance_repair_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ])

    const requisitions = (reqResult.data || []).filter(matchesLinkedStaff)
    const gadgetRequests = (gadgetResult.data || []).filter(matchesLinkedStaff)
    const maintenanceRequests = (maintResult.data || []).filter(matchesLinkedStaff)

    return NextResponse.json({
      success: true,
      requisitions,
      gadgetRequests,
      maintenanceRequests,
      linkedStaffCount: linkedStaffIds.length,
    })
  } catch (error: any) {
    console.error("[v0] Error fetching HOD-scoped requests:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch HOD requests" }, { status: 500 })
  }
}
