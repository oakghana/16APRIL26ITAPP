import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeDepartmentName, isITDDepartment } from "@/lib/department-options"
import { sendItFormEmail } from "@/lib/it-form-email"
import { generateITFormDeptHeadRequestHTML, generateITFormCompletionHTML } from "@/lib/email-service"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

const TABLE = "asset_transfer_requests"
const PREFIX = "AT"

function isUuid(v?: string | null) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}
function canManageAsIT(role?: string | null, dept?: string | null) {
  const r = (role || "").toLowerCase()
  return r === "admin" || r === "it_head" || (r === "department_head" && isITDDepartment(dept))
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
      assetType, assetDescription, serialNumber, fromDepartment, fromLocation,
      toDepartment, toLocation, transferReason, handoverCondition, submittedByRole, submittedByEmail } = b

    if (!staffName || !assetType || !assetDescription || !fromDepartment || !fromLocation || !toDepartment || !toLocation || !transferReason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

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
      asset_type: assetType,
      asset_description: assetDescription,
      serial_number: serialNumber || null,
      from_department: normalizeDepartmentName(fromDepartment) || fromDepartment,
      from_location: fromLocation,
      to_department: normalizeDepartmentName(toDepartment) || toDepartment,
      to_location: toLocation,
      transfer_reason: transferReason,
      handover_condition: ["good","fair","needs_repair"].includes(handoverCondition) ? handoverCondition : "good",
      status: "pending_dept_head",
      approval_timeline: [{ action: "submitted", role: "requester", actor: staffName, timestamp: now }],
      created_by: staffName,
      created_by_role: submittedByRole || null,
      created_by_email: submittedByEmail || requestedByEmail || null,
      created_at: now,
      updated_at: now,
    }]).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Notify department head
    void (async () => {
      try {
        const dept = normalizeDepartmentName(departmentName) || departmentName
        const { data: dh } = await supabaseAdmin
          .from("profiles")
          .select("full_name,email")
          .eq("role", "department_head")
          .ilike("department", dept)
          .single()
        if (dh?.email) {
          const html = generateITFormDeptHeadRequestHTML({
            deptHeadName: dh.full_name || "Department Head",
            requesterName: staffName,
            requestNumber,
            formTitle: "Asset Transfer Request",
            summary: `${assetType}: ${assetDescription} — from ${fromDepartment} to ${toDepartment}`,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://it.qccghana.com"}/dashboard/it-forms/asset-transfer/${data.id}`,
          })
          await sendItFormEmail({ to: dh.email, subject: `[Action Required] Asset Transfer Request ${requestNumber}`, html })
        }
      } catch {}
    })()
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

    if (action === "dept_head_approve") {
      if ((role || "").toLowerCase() !== "department_head") return NextResponse.json({ error: "Only department heads may approve" }, { status: 403 })
      if (record.status !== "pending_dept_head") return NextResponse.json({ error: "Not awaiting dept head approval" }, { status: 409 })
      Object.assign(updateData, {
        status: "pending_manager",
        dept_head_id: isUuid(actorId) ? actorId : null,
        dept_head_name: actorName || actorProfile?.full_name || null,
        dept_head_email: actorProfile?.email || null,
        dept_head_approved_at: now,
        dept_head_notes: notes || null,
        dept_head_signature: managerSignature || null,
      })
    } else if (action === "dept_head_reject") {
      if ((role || "").toLowerCase() !== "department_head") return NextResponse.json({ error: "Only department heads may reject" }, { status: 403 })
      if (record.status !== "pending_dept_head") return NextResponse.json({ error: "Not awaiting dept head approval" }, { status: 409 })
      Object.assign(updateData, {
        status: "rejected",
        dept_head_id: isUuid(actorId) ? actorId : null,
        dept_head_name: actorName || actorProfile?.full_name || null,
        dept_head_email: actorProfile?.email || null,
        dept_head_approved_at: now,
        dept_head_notes: notes || null,
      })
    } else if (action === "manager_assign") {
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

    // Send completion email
    if (action === "assignee_complete" && record.requested_by_email) {
      void sendItFormEmail({
        to: record.requested_by_email,
        subject: `Your Asset Transfer Request ${record.request_number} is Complete`,
        html: generateITFormCompletionHTML({
          requesterName: record.staff_name || "Requester",
          requestNumber: record.request_number,
          formTitle: "Asset Transfer Request",
          summary: `${record.asset_type}: ${record.asset_description}`,
          workNotes: notes || "Transfer completed.",
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://it.qccghana.com"}/dashboard/it-forms/asset-transfer/${requestId}`,
        }),
      })
    }
    return NextResponse.json({ success: true, request: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
