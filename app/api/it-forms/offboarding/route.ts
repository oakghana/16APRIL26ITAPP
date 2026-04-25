import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeDepartmentName } from "@/lib/department-options"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

const TABLE = "offboarding_requests"
const PREFIX = "OFF"

function isUuid(v?: string | null) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}
function canManageAsIT(role?: string | null, dept?: string | null) {
  const r = (role || "").toLowerCase()
  return r === "admin" || r === "it_head" || (r === "department_head" && (dept || "").toLowerCase().includes("it"))
}
function appendTimeline(existing: any, entry: Record<string, any>) {
  return [...(Array.isArray(existing) ? existing : []), entry]
}

async function nextNumber() {
  const { data } = await supabaseAdmin.from(TABLE).select("request_number").order("created_at", { ascending: false }).limit(1)
  const last = Number((data?.[0]?.request_number || `${PREFIX}-0000`).split("-").pop() || "0")
  return `${PREFIX}-${String(last + 1).padStart(4, "0")}`
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const { staffName, requestedById, requestedByEmail, departmentName, requesterLocation, requestDate,
      departingStaffName, departingStaffEmail, departingStaffRole, departingStaffDepartment,
      lastWorkDate, departureReason, specialNotes, submittedByRole, submittedByEmail } = b

    if (!staffName || !departingStaffName || !departingStaffDepartment || !lastWorkDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const validReasons = ["resignation","transfer","retirement","contract_end","termination","other"]
    const now = new Date().toISOString()
    const requestNumber = await nextNumber()

    const { data, error } = await supabaseAdmin.from(TABLE).insert([{
      request_number: requestNumber,
      staff_name: staffName,
      requested_by_id: isUuid(requestedById) ? requestedById : null,
      requested_by_email: requestedByEmail || null,
      department_name: normalizeDepartmentName(departmentName) || null,
      requester_location: requesterLocation || null,
      request_date: requestDate || now.split("T")[0],
      departing_staff_name: departingStaffName,
      departing_staff_email: departingStaffEmail || null,
      departing_staff_role: departingStaffRole || null,
      departing_staff_department: normalizeDepartmentName(departingStaffDepartment) || departingStaffDepartment,
      last_work_date: lastWorkDate,
      departure_reason: validReasons.includes(departureReason) ? departureReason : "resignation",
      special_notes: specialNotes || null,
      status: "pending_manager",
      approval_timeline: [{ action: "submitted", role: "requester", actor: staffName, timestamp: now }],
      created_by: staffName,
      created_by_role: submittedByRole || null,
      created_by_email: submittedByEmail || requestedByEmail || null,
      created_at: now,
      updated_at: now,
    }]).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, request: data, requestNumber })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get("mode")
    const viewerId = searchParams.get("viewerId")
    const status = searchParams.get("status")
    const requestedById = searchParams.get("requestedById")
    const assigneeId = searchParams.get("assigneeId")

    if (mode === "assignees") {
      const viewer = viewerId && isUuid(viewerId)
        ? (await supabaseAdmin.from("profiles").select("id,role,department,location").eq("id", viewerId).single()).data
        : null
      if (!viewer || !canManageAsIT(viewer.role, viewer.department)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
      const { data } = await supabaseAdmin.from("profiles")
        .select("id,full_name,email,role,location")
        .in("role", ["it_staff","regional_it_head","it_head"])
        .eq("status", "approved")
      return NextResponse.json({ success: true, assignees: data || [] })
    }

    let query = supabaseAdmin.from(TABLE).select("*").order("created_at", { ascending: false })
    if (status && status !== "all") query = query.eq("status", status)
    if (requestedById && isUuid(requestedById)) query = query.eq("requested_by_id", requestedById)
    if (assigneeId && isUuid(assigneeId)) query = query.eq("assigned_to_id", assigneeId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, requests: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestId, action, actorId, actorName, actorRole, actorDepartment, notes,
      managerSignature, assignToId, assignToName, assignToRole } = body

    if (!requestId || !action) return NextResponse.json({ error: "Missing requestId or action" }, { status: 400 })

    const { data: record, error: loadErr } = await supabaseAdmin.from(TABLE).select("*").eq("id", requestId).single()
    if (loadErr || !record) return NextResponse.json({ error: "Record not found" }, { status: 404 })

    const actorProfile = isUuid(actorId)
      ? (await supabaseAdmin.from("profiles").select("id,role,department,location,full_name,email").eq("id", actorId).single()).data
      : null
    const role = actorProfile?.role || actorRole
    const dept = actorProfile?.department || actorDepartment
    const now = new Date().toISOString()

    const updateData: Record<string, any> = {
      updated_at: now,
      approval_timeline: appendTimeline(record.approval_timeline, {
        action, role: role || "unknown",
        actor: actorName || actorProfile?.full_name || "Unknown",
        notes: notes || null, timestamp: now,
      }),
    }

    if (action === "manager_assign") {
      if (!canManageAsIT(role, dept)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      if (!["pending_manager","reopened"].includes(record.status)) return NextResponse.json({ error: "Not pending" }, { status: 409 })
      if (!assignToName) return NextResponse.json({ error: "Select assignee" }, { status: 400 })
      if (!managerSignature) return NextResponse.json({ error: "Signature required" }, { status: 400 })
      Object.assign(updateData, {
        status: "assigned",
        manager_approved_by: actorName || actorProfile?.full_name || "IT Manager",
        manager_approved_by_id: isUuid(actorId) ? actorId : null,
        manager_approved_at: now,
        manager_notes: notes || null,
        manager_signature: managerSignature,
        assigned_to: assignToName,
        assigned_to_id: isUuid(assignToId) ? assignToId : null,
        assigned_to_role: assignToRole || null,
        assigned_at: now,
      })
    } else if (action === "manager_reject") {
      if (!canManageAsIT(role, dept)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      Object.assign(updateData, {
        status: "rejected",
        manager_approved_by: actorName || actorProfile?.full_name || "IT Manager",
        manager_approved_by_id: isUuid(actorId) ? actorId : null,
        manager_approved_at: now,
        manager_notes: notes || null,
      })
    } else if (action === "assignee_start") {
      Object.assign(updateData, { status: "in_progress", work_started_at: record.work_started_at || now })
    } else if (action === "assignee_complete") {
      if (!String(notes || "").trim()) return NextResponse.json({ error: "Work notes required" }, { status: 400 })
      Object.assign(updateData, {
        status: "completed",
        work_started_at: record.work_started_at || now,
        work_completed_at: now,
        work_notes: notes,
      })
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const { data: updated, error: updateErr } = await supabaseAdmin.from(TABLE).update(updateData).eq("id", requestId).select().single()
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ success: true, request: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
