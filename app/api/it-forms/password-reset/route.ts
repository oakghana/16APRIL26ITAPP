import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isLocationInSameRegion, normalizeLocation } from "@/lib/location-filter"
import { normalizeDepartmentName, isITDDepartment } from "@/lib/department-options"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-placeholder"
)

type PasswordResetStatus =
  | "pending_manager"
  | "assigned"
  | "in_progress"
  | "awaiting_user_confirmation"
  | "completed"
  | "reopened"
  | "rejected"

function isUuidLike(value?: string | null) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeText(value?: string | null) {
  return String(value || "").toLowerCase().trim()
}

function canManageAsIT(role?: string | null, department?: string | null) {
  const normalizedRole = normalizeText(role)
  if (normalizedRole === "admin") return true
  return normalizedRole === "department_head" && isITDDepartment(department)
}

function canSeeNationwide(role?: string | null, location?: string | null) {
  const normalizedRole = normalizeText(role)
  const normalizedLocation = normalizeLocation(location)
  if (["admin", "it_head", "it_store_head"].includes(normalizedRole)) return true
  if (normalizedRole.startsWith("service_desk") && ["accra", "head_office"].includes(normalizedLocation)) return true
  return false
}

function canWorkPasswordResets(role?: string | null, department?: string | null) {
  const normalizedRole = normalizeText(role)
  if (["admin", "it_head", "it_staff", "regional_it_head"].includes(normalizedRole)) return true
  return normalizedRole === "department_head" && isITDDepartment(department)
}

async function generateNextSequentialNumber() {
  const { data } = await supabaseAdmin
    .from("password_reset_requests")
    .select("request_number")
    .order("created_at", { ascending: false })
    .limit(1)

  const previousNumber = data?.[0]?.request_number || "PR-0000"
  const lastSequence = Number(previousNumber.split("-").pop() || "0")
  return `PR-${String(lastSequence + 1).padStart(4, "0")}`
}

async function getViewerProfile(viewerId?: string | null) {
  if (!viewerId || !isUuidLike(viewerId)) return null
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, role, department, location, full_name, email")
    .eq("id", viewerId)
    .single()
  return data || null
}

function appendTimeline(existing: any, entry: Record<string, any>) {
  const timeline = Array.isArray(existing) ? existing : []
  return [...timeline, entry]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      staffName,
      requestedById,
      requestedByEmail,
      departmentName,
      requesterLocation,
      requestDate,
      systemName,
      otherSystemName,
      accountIdentifier,
      issueSummary,
      urgency,
      submittedByRole,
      submittedByEmail,
    } = body

    const normalizedDepartment = normalizeDepartmentName(departmentName)
    if (!systemName || !accountIdentifier || !issueSummary || !staffName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (systemName === "Other" && !String(otherSystemName || "").trim()) {
      return NextResponse.json({ error: "Custom system name is required when selecting Other" }, { status: 400 })
    }

    const requestNumber = await generateNextSequentialNumber()
    const now = new Date().toISOString()

    const insertData = {
      request_number: requestNumber,
      staff_name: staffName,
      requested_by_id: isUuidLike(requestedById) ? requestedById : null,
      requested_by_email: requestedByEmail || null,
      department_name: normalizedDepartment || null,
      requester_location: requesterLocation || null,
      request_date: requestDate || now.split("T")[0],
      system_name: systemName,
      other_system_name: systemName === "Other" ? String(otherSystemName || "").trim() : null,
      account_identifier: accountIdentifier,
      issue_summary: issueSummary,
      urgency: ["low", "medium", "high", "critical"].includes(urgency) ? urgency : "medium",
      status: "pending_manager",
      approval_timeline: [
        {
          action: "submitted",
          role: "requester",
          actor: staffName,
          notes: "Password reset request submitted",
          timestamp: now,
        },
      ],
      created_by: staffName,
      created_by_role: submittedByRole || null,
      created_by_email: submittedByEmail || requestedByEmail || null,
      created_at: now,
      updated_at: now,
    }

    const { data, error } = await supabaseAdmin
      .from("password_reset_requests")
      .insert([insertData])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create password reset request" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      request: data,
      requestNumber,
      message: "Password reset request submitted for IT manager approval",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode")
    const viewerId = searchParams.get("viewerId")
    const requestedById = searchParams.get("requestedById")
    const status = searchParams.get("status")
    const assigneeId = searchParams.get("assigneeId")

    const viewer = await getViewerProfile(viewerId)

    if (mode === "assignees") {
      if (!viewer || !canManageAsIT(viewer.role, viewer.department)) {
        return NextResponse.json({ error: "Only IT manager/admin can load assignees" }, { status: 403 })
      }

      let query = supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, role, location, department")
        .in("role", ["it_staff", "regional_it_head", "it_head"]) // assignable technical roles
        .eq("status", "approved")
        .eq("is_active", true)

      if (!canSeeNationwide(viewer.role, viewer.location)) {
        query = query.eq("location", viewer.location)
      }

      const { data, error } = await query.order("full_name", { ascending: true })
      if (error) {
        return NextResponse.json({ error: error.message || "Failed to load assignees" }, { status: 500 })
      }

      const includeSelf = canWorkPasswordResets(viewer.role, viewer.department)
        ? [{
            id: viewer.id,
            full_name: viewer.full_name || viewer.email || "IT Manager",
            email: viewer.email,
            role: viewer.role,
            location: viewer.location,
            department: viewer.department,
          }]
        : []

      const seen = new Set<string>()
      const assignees = [...includeSelf, ...(data || [])].filter((person) => {
        if (!person?.id || seen.has(person.id)) return false
        seen.add(person.id)
        return true
      })

      return NextResponse.json({ success: true, assignees })
    }

    let query = supabaseAdmin
      .from("password_reset_requests")
      .select("*")
      .order("created_at", { ascending: false })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (requestedById && isUuidLike(requestedById)) {
      query = query.eq("requested_by_id", requestedById)
    }

    if (assigneeId && isUuidLike(assigneeId)) {
      query = query.eq("assigned_to_id", assigneeId)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load password reset requests" }, { status: 500 })
    }

    let requests = data || []

    if (viewer) {
      const role = normalizeText(viewer.role)
      if (role !== "admin" && !canSeeNationwide(viewer.role, viewer.location)) {
        if (role === "it_staff" || role === "regional_it_head") {
          requests = requests.filter((row: any) => {
            const requesterLocation = String(row.requester_location || "")
            if (!requesterLocation || !viewer.location) return false
            return isLocationInSameRegion(requesterLocation, viewer.location)
          })
        } else if (!canManageAsIT(viewer.role, viewer.department)) {
          requests = requests.filter((row: any) => {
            const requesterMatch = row.requested_by_id && row.requested_by_id === viewer.id
            const assigneeMatch = row.assigned_to_id && row.assigned_to_id === viewer.id
            return Boolean(requesterMatch || assigneeMatch)
          })
        }
      }
    }

    return NextResponse.json({ success: true, requests })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      requestId,
      action,
      actorId,
      actorName,
      actorRole,
      actorDepartment,
      actorLocation,
      notes,
      managerSignature,
      assignToId,
      assignToName,
      assignToRole,
      systemName,
      otherSystemName,
      accountIdentifier,
      issueSummary,
      urgency,
      confirmation,
    } = body

    if (!requestId || !action) {
      return NextResponse.json({ error: "Missing requestId or action" }, { status: 400 })
    }

    const { data: record, error: loadError } = await supabaseAdmin
      .from("password_reset_requests")
      .select("*")
      .eq("id", requestId)
      .single()

    if (loadError || !record) {
      return NextResponse.json({ error: "Password reset request not found" }, { status: 404 })
    }

    const actorProfile = await getViewerProfile(actorId)
    const effectiveRole = actorProfile?.role || actorRole
    const effectiveDepartment = actorProfile?.department || actorDepartment
    const effectiveLocation = actorProfile?.location || actorLocation

    const now = new Date().toISOString()
    const updateData: Record<string, any> = {
      updated_at: now,
    }

    const timeline = appendTimeline(record.approval_timeline, {
      action,
      role: effectiveRole || actorRole || "unknown",
      actor: actorName || actorProfile?.full_name || actorProfile?.email || "Unknown",
      notes: notes || null,
      timestamp: now,
    })

    if (action === "update_request") {
      const isOwner = (isUuidLike(actorId) && record.requested_by_id === actorId)
        || normalizeText(record.staff_name) === normalizeText(actorName)
      if (!isOwner) {
        return NextResponse.json({ error: "Only requester can edit this request" }, { status: 403 })
      }
      if (!["pending_manager", "reopened"].includes(record.status)) {
        return NextResponse.json({ error: "Request cannot be edited after assignment" }, { status: 409 })
      }

      if (!systemName || !accountIdentifier || !issueSummary) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }

      updateData.system_name = systemName
      updateData.other_system_name = systemName === "Other" ? String(otherSystemName || "").trim() : null
      updateData.account_identifier = accountIdentifier
      updateData.issue_summary = issueSummary
      updateData.urgency = ["low", "medium", "high", "critical"].includes(urgency) ? urgency : record.urgency
      updateData.approval_timeline = timeline
    } else if (action === "manager_assign") {
      if (!canManageAsIT(effectiveRole, effectiveDepartment)) {
        return NextResponse.json({ error: "Only IT manager/admin can approve and assign" }, { status: 403 })
      }
      if (!["pending_manager", "reopened"].includes(record.status)) {
        return NextResponse.json({ error: "Request is not pending manager review" }, { status: 409 })
      }
      if (!assignToName) {
        return NextResponse.json({ error: "Select assignee" }, { status: 400 })
      }
      if (!managerSignature) {
        return NextResponse.json({ error: "Manager signature is required" }, { status: 400 })
      }

      if (!canSeeNationwide(effectiveRole, effectiveLocation) && effectiveLocation && record.requester_location) {
        const sameRegion = isLocationInSameRegion(record.requester_location, effectiveLocation)
        if (!sameRegion) {
          return NextResponse.json({ error: "You can only assign requests in your region" }, { status: 403 })
        }
      }

      updateData.status = "assigned"
      updateData.manager_approved_by = actorName || actorProfile?.full_name || actorProfile?.email || "IT Manager"
      updateData.manager_approved_by_id = isUuidLike(actorId) ? actorId : null
      updateData.manager_approved_at = now
      updateData.manager_notes = notes || null
      updateData.manager_signature = managerSignature
      updateData.assigned_to = assignToName
      updateData.assigned_to_id = isUuidLike(assignToId) ? assignToId : null
      updateData.assigned_to_role = assignToRole || null
      updateData.assigned_at = now
      updateData.approval_timeline = timeline
    } else if (action === "manager_reject") {
      if (!canManageAsIT(effectiveRole, effectiveDepartment)) {
        return NextResponse.json({ error: "Only IT manager/admin can reject" }, { status: 403 })
      }
      if (!["pending_manager", "reopened"].includes(record.status)) {
        return NextResponse.json({ error: "Request is not pending manager review" }, { status: 409 })
      }
      updateData.status = "rejected"
      updateData.manager_approved_by = actorName || actorProfile?.full_name || actorProfile?.email || "IT Manager"
      updateData.manager_approved_by_id = isUuidLike(actorId) ? actorId : null
      updateData.manager_approved_at = now
      updateData.manager_notes = notes || null
      updateData.manager_signature = managerSignature || null
      updateData.approval_timeline = timeline
    } else if (action === "assignee_start") {
      const isAssignedActor = isUuidLike(actorId) && record.assigned_to_id && record.assigned_to_id === actorId
      const canOverride = canManageAsIT(effectiveRole, effectiveDepartment)
      if (!isAssignedActor && !canOverride) {
        return NextResponse.json({ error: "Only assigned IT staff can start this work" }, { status: 403 })
      }
      if (!["assigned", "reopened"].includes(record.status)) {
        return NextResponse.json({ error: "Request is not ready to start" }, { status: 409 })
      }

      updateData.status = "in_progress"
      updateData.work_started_at = record.work_started_at || now
      updateData.approval_timeline = timeline
    } else if (action === "assignee_submit") {
      const isAssignedActor = isUuidLike(actorId) && record.assigned_to_id && record.assigned_to_id === actorId
      const canOverride = canManageAsIT(effectiveRole, effectiveDepartment)
      if (!isAssignedActor && !canOverride) {
        return NextResponse.json({ error: "Only assigned IT staff can submit completion" }, { status: 403 })
      }
      if (!["assigned", "in_progress", "reopened"].includes(record.status)) {
        return NextResponse.json({ error: "Request is not active" }, { status: 409 })
      }
      if (!String(notes || "").trim()) {
        return NextResponse.json({ error: "Work notes are required" }, { status: 400 })
      }

      updateData.status = "awaiting_user_confirmation"
      updateData.work_started_at = record.work_started_at || now
      updateData.work_completed_at = now
      updateData.work_notes = notes
      updateData.submitted_for_confirmation_at = now
      updateData.approval_timeline = timeline
    } else if (action === "user_confirm") {
      const requesterById = isUuidLike(actorId) && record.requested_by_id && record.requested_by_id === actorId
      const requesterByName = normalizeText(record.staff_name) === normalizeText(actorName)
      const isRequester = Boolean(requesterById || requesterByName)
      const canOverride = normalizeText(effectiveRole) === "admin"

      if (!isRequester && !canOverride) {
        return NextResponse.json({ error: "Only requester can confirm completion" }, { status: 403 })
      }
      if (record.status !== "awaiting_user_confirmation") {
        return NextResponse.json({ error: "Request is not awaiting confirmation" }, { status: 409 })
      }

      const approved = confirmation === "approved"
      updateData.user_confirmed = approved
      updateData.user_confirmed_by = actorName || actorProfile?.full_name || actorProfile?.email || record.staff_name
      updateData.user_confirmed_by_id = isUuidLike(actorId) ? actorId : null
      updateData.user_confirmed_at = now
      updateData.confirmation_status = approved ? "approved" : "rejected"
      updateData.confirmation_notes = notes || null
      updateData.status = approved ? "completed" : "reopened"
      updateData.closed_at = approved ? now : null
      updateData.approval_timeline = timeline
    } else {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("password_reset_requests")
      .update(updateData)
      .eq("id", requestId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Failed to update request" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      request: updated,
      message: "Password reset request updated",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
