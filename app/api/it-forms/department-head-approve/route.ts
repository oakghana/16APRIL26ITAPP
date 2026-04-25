import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeDepartmentName } from "@/lib/department-options"

type FormType = "requisition" | "new-gadget" | "maintenance"

const FORM_CONFIG: Record<FormType, { table: string; numberField: string; requesterField: string; relatedType: string }> = {
  requisition: {
    table: "it_equipment_requisitions",
    numberField: "requisition_number",
    requesterField: "requested_by",
    relatedType: "it_equipment_requisition",
  },
  "new-gadget": {
    table: "new_gadget_requests",
    numberField: "request_number",
    requesterField: "staff_name",
    relatedType: "new_gadget_request",
  },
  maintenance: {
    table: "maintenance_repair_requests",
    numberField: "request_number",
    requesterField: "staff_name",
    relatedType: "maintenance_repair_request",
  },
}

function isUuidLike(value?: string | null) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
    )

    const { requisitionId, action, approvedBy, approvedById, notes, formType = "requisition", hodSignature } = await request.json()

    if (!requisitionId || !action || !approvedBy || !notes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'" }, { status: 400 })
    }

    if (action === "approve" && !hodSignature) {
      return NextResponse.json({ error: "Digital signature is required for approval" }, { status: 400 })
    }

    if (!approvedById || !isUuidLike(approvedById)) {
      return NextResponse.json({ error: "Approver identity is required" }, { status: 400 })
    }

    const config = FORM_CONFIG[formType as FormType]
    if (!config) {
      return NextResponse.json({ error: "Unsupported form type" }, { status: 400 })
    }

    const { data: requisition, error: fetchError } = await supabaseAdmin
      .from(config.table)
      .select("*")
      .eq("id", requisitionId)
      .single()

    if (fetchError || !requisition) {
      console.error("[v0] Error fetching requisition:", fetchError)
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const { data: approverProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, department")
      .eq("id", approvedById)
      .single()

    if (profileError || !approverProfile) {
      return NextResponse.json({ error: "Approver profile not found" }, { status: 403 })
    }

    const approverRole = String(approverProfile.role || "").toLowerCase()
    const approverDepartment = normalizeDepartmentName(approverProfile.department)
    const requestDepartment = normalizeDepartmentName(requisition.department || requisition.department_name)

    const isAdmin = approverRole === "admin"
    const isDepartmentHead = approverRole === "department_head"

    if (!isAdmin && !isDepartmentHead) {
      return NextResponse.json({ error: "Only Admin or Department Head can approve" }, { status: 403 })
    }

    if (isDepartmentHead && (!requestDepartment || !approverDepartment || approverDepartment !== requestDepartment)) {
      return NextResponse.json({ error: "You can only approve requests from your department" }, { status: 403 })
    }

    const now = new Date().toISOString()
    const approvedByUuid = isUuidLike(approvedById) ? approvedById : null
    const updateData: any = {
      updated_at: now,
      status:
        formType === "requisition"
          ? action === "approve"
            ? "pending_it_office_use"
            : "rejected_department_head"
          : action === "approve"
            ? "pending_it_office_use"
            : "rejected",
    }

    if (formType === "requisition") {
      updateData.department_head_notes = notes
      updateData.department_head_approved = action === "approve"
      updateData.department_head_approved_by = approvedBy
      updateData.department_head_approved_at = now
      if (action === "approve" && hodSignature) {
        updateData.department_head_signature = hodSignature
      }

      const approvalChain = Array.isArray(requisition.approval_timeline)
        ? [...requisition.approval_timeline]
        : Array.isArray(requisition.approval_chain)
          ? [...requisition.approval_chain]
          : []
      approvalChain.push({
        approver: approvedBy,
        role: "department_head",
        action,
        notes,
        timestamp: now,
        signature: action === "approve" ? !!hodSignature : undefined,
        signatureDataUrl: action === "approve" ? hodSignature : undefined,
      })
      updateData.approval_timeline = approvalChain
    }

    if (formType === "new-gadget") {
      updateData.departmental_head_name = approvedBy
      updateData.departmental_head_date = now.split("T")[0]
      if (action === "approve" && hodSignature) {
        updateData.department_head_signature = hodSignature
      }
      updateData.other_comments = [
        requisition.other_comments,
        `HOD ${action === "approve" ? "approval" : "rejection"} note: ${notes}`,
      ]
        .filter(Boolean)
        .join("\n")
    }

    if (formType === "maintenance") {
      updateData.sectional_head_name = approvedBy
      updateData.sectional_head_date = now.split("T")[0]
      if (action === "approve" && hodSignature) {
        updateData.department_head_signature = hodSignature
      }
      updateData.other_comments = [
        requisition.other_comments,
        `HOD ${action === "approve" ? "approval" : "rejection"} note: ${notes}`,
      ]
        .filter(Boolean)
        .join("\n")
    }

    let updated: any = null
    let updateError: any = null
    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await supabaseAdmin
        .from(config.table)
        .update(updateData)
        .eq("id", requisitionId)
        .select()
        .single()

      updated = result.data
      updateError = result.error
      if (!updateError) break

      const message = String(updateError.message || "")
      const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i)
      const missingColumn = missingColumnMatch?.[1]

      if (missingColumn) {
        if (missingColumn === "approval_timeline" && updateData.approval_timeline) {
          updateData.approval_chain = updateData.approval_timeline
        }

        if (missingColumn === "approval_chain" && updateData.approval_chain) {
          delete updateData.approval_chain
          continue
        }

        delete updateData[missingColumn]
        continue
      }

      if (updateError.code === "22P02" && /invalid input syntax for type uuid/i.test(message)) {
        const uuidByFields = ["department_head_approved_by", "departmental_head_name", "sectional_head_name"]
        let changed = false
        for (const field of uuidByFields) {
          if (Object.prototype.hasOwnProperty.call(updateData, field)) {
            updateData[field] = approvedByUuid
            changed = true
          }
        }
        if (changed) continue
      }
      break
    }

    if (updateError) {
      console.error("[v0] Error updating requisition:", updateError)
      return NextResponse.json({ error: updateError.message || "Failed to update request" }, { status: 500 })
    }

    const requestNumber = requisition[config.numberField]
    const requesterName = requisition[config.requesterField]

    // Create notification for requester about HOD decision
    if (requisition.requested_by_id) {
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: requisition.requested_by_id,
          title: `Department Head ${action === "approve" ? "Approved" : "Rejected"} Your Request`,
          message: `Your request ${requestNumber} has been ${action === "approve" ? "approved" : "rejected"} by your department head${hodSignature ? " with digital signature" : ""}.`,
          type: action === "approve" ? "success" : "warning",
          category: "approval",
          reference_type: config.relatedType,
          reference_id: requisitionId,
          is_read: false,
        })
        .catch((err) => console.error("[v0] Error creating notification for requester:", err))
    }

    // Create notification for IT office-use staff in request location if approved
    if (action === "approve") {
      let targetLocation = ""
      if (requisition.requested_by_id) {
        const { data: requesterProfile } = await supabaseAdmin
          .from("profiles")
          .select("location")
          .eq("id", requisition.requested_by_id)
          .single()
        targetLocation = String(requesterProfile?.location || "")
      }

      let officeUseQuery = supabaseAdmin
        .from("profiles")
        .select("id")
        .in("role", [
          "it_staff",
          "service_desk_staff",
          "service_desk_accra",
          "service_desk_kumasi",
          "service_desk_takoradi",
          "service_desk_tema",
          "service_desk_sunyani",
          "service_desk_cape_coast",
        ])
        .eq("is_active", true)

      if (targetLocation) {
        officeUseQuery = officeUseQuery.eq("location", targetLocation)
      }

      const { data: officeUseStaff } = await officeUseQuery

      if (officeUseStaff && officeUseStaff.length > 0) {
        const notifications = officeUseStaff.map((staff) => ({
          user_id: staff.id,
          title: "New Request Awaiting IT Office Use",
          message: `Request ${requestNumber} from ${requesterName} has been HOD approved and needs IT office-use processing${targetLocation ? ` (${targetLocation})` : ""}.`,
          type: "info" as const,
          category: "approval" as const,
          reference_type: config.relatedType,
          reference_id: requisitionId,
          is_read: false,
        }))

        await supabaseAdmin
          .from("notifications")
          .insert(notifications)
          .catch((err) => console.error("[v0] Error creating IT office-use notifications:", err))
      }
    }

    // Create notification for rejection - notify admin
    if (action === "reject") {
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true)

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: "Request Rejected by Department Head",
          message: `Request ${requestNumber} from ${requesterName} was rejected by the department head. Reason: ${notes}`,
          type: "warning" as const,
          category: "approval" as const,
          reference_type: config.relatedType,
          reference_id: requisitionId,
          is_read: false,
        }))

        await supabaseAdmin
          .from("notifications")
          .insert(notifications)
          .catch((err) => console.error("[v0] Error creating admin rejection notifications:", err))
      }
    }

    return NextResponse.json({ success: true, requisition: updated })
  } catch (error: any) {
    console.error("[v0] API Error in department head approval:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
