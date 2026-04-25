import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type FormType = "new-gadget" | "maintenance"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

function isUuidLike(value?: string | null) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isAuthorizedManager(userRole: string, userDepartment: string) {
  return (
    userRole === "admin" ||
    userRole === "it_head" ||
    (userRole === "department_head" && userDepartment?.toLowerCase().includes("it"))
  )
}

const FORM_CONFIG: Record<FormType, { table: string; numberField: string; relatedType: string }> = {
  "new-gadget": {
    table: "new_gadget_requests",
    numberField: "request_number",
    relatedType: "new_gadget_request",
  },
  maintenance: {
    table: "maintenance_repair_requests",
    numberField: "request_number",
    relatedType: "maintenance_repair_request",
  },
}

export async function POST(request: NextRequest) {
  try {
    const { requisitionId, formType, action, approvedBy, approvedById, notes, approverSignature, userRole, userDepartment } = await request.json()

    if (!requisitionId || !formType || !action || !approvedBy || !notes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!isAuthorizedManager(userRole || "", userDepartment || "")) {
      return NextResponse.json({ error: "Unauthorized to review in this role" }, { status: 403 })
    }

    if (action === "approve" && !approverSignature) {
      return NextResponse.json({ error: "Digital signature is required for approval" }, { status: 400 })
    }

    const config = FORM_CONFIG[formType as FormType]
    if (!config) {
      return NextResponse.json({ error: "Unsupported form type" }, { status: 400 })
    }

    const { data: reqData, error: fetchError } = await supabaseAdmin
      .from(config.table)
      .select("*")
      .eq("id", requisitionId)
      .single()

    if (fetchError || !reqData) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (reqData.status !== "pending_manager") {
      return NextResponse.json({ error: "This request is not awaiting manager review" }, { status: 409 })
    }

    const nowIso = new Date().toISOString()
    const actionLabel = action === "approve" ? "approved" : "rejected"
    const approvedByUuid = isUuidLike(approvedById) ? approvedById : null

    const updateData: Record<string, any> = {
      updated_at: nowIso,
      other_comments: [
        reqData.other_comments,
        `IT Manager ${actionLabel} note: ${notes} (by ${approvedBy} on ${nowIso})`,
      ]
        .filter(Boolean)
        .join("\n"),
    }

    if (Object.prototype.hasOwnProperty.call(reqData, "it_manager_approved_by")) {
      updateData.it_manager_approved_by = approvedBy
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "it_manager_approved_at")) {
      updateData.it_manager_approved_at = nowIso
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "it_manager_signature") && approverSignature) {
      updateData.it_manager_signature = approverSignature
    }

    // Persist manager identity/signature into available schema columns.
    if (Object.prototype.hasOwnProperty.call(reqData, "it_head_approved_by")) {
      updateData.it_head_approved_by = approvedBy
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "it_head_approved_at")) {
      updateData.it_head_approved_at = nowIso
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "admin_approved_by") && userRole === "admin") {
      updateData.admin_approved_by = approvedBy
    }
    if (Object.prototype.hasOwnProperty.call(reqData, "admin_approved_at") && userRole === "admin") {
      updateData.admin_approved_at = nowIso
    }

    if (approverSignature) {
      if (Object.prototype.hasOwnProperty.call(reqData, "it_head_signature")) {
        updateData.it_head_signature = approverSignature
      }
      if (Object.prototype.hasOwnProperty.call(reqData, "admin_signature") && userRole === "admin") {
        updateData.admin_signature = approverSignature
      }
    }

    if (formType === "new-gadget") {
      updateData.status = action === "approve" ? "recommended" : "not_recommended"
      updateData.recommended = action === "approve"
    } else {
      updateData.status = action === "approve" ? "manager_confirmed" : "rejected"
    }

    const hasApprovalTimelineColumn = Object.prototype.hasOwnProperty.call(reqData, "approval_timeline")
    if (hasApprovalTimelineColumn) {
      const existingTimeline = Array.isArray(reqData.approval_timeline)
        ? reqData.approval_timeline
        : Array.isArray(reqData.approval_chain)
          ? reqData.approval_chain
          : []
      updateData.approval_timeline = [
        ...existingTimeline,
        {
          approver: approvedBy,
          role: "it_manager",
          action,
          notes,
          timestamp: nowIso,
          signature: action === "approve" ? !!approverSignature : undefined,
          signatureDataUrl: action === "approve" ? approverSignature : undefined,
        },
      ]
    }

    let updated: any = null
    let updateError: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
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
      if (updateError.code === "22P02" && /invalid input syntax for type uuid/i.test(message)) {
        const uuidByFields = ["it_manager_approved_by", "it_head_approved_by", "admin_approved_by"]
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
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
    }

    try {
      const requestNumber = reqData?.[config.numberField] || requisitionId
      await supabaseAdmin.from("notifications").insert([
        {
          user_id: reqData.requested_by_id || null,
          title: `IT Manager ${action === "approve" ? "Reviewed" : "Rejected"} Request`,
          message: `Request ${requestNumber} was ${actionLabel} at manager stage.`,
          type: "info",
          category: "approval",
          reference_type: config.relatedType,
          reference_id: requisitionId,
          is_read: false,
        },
      ])
    } catch (notifyError) {
      console.error("[manager-approve] Notification error:", notifyError)
    }

    return NextResponse.json({ success: true, requisition: updated })
  } catch (error) {
    console.error("[manager-approve] API error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
