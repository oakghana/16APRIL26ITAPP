import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

function isUuidLike(value?: string | null) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isAuthorizedForRole(approverRole: string | undefined, userRole: string, userDepartment: string) {
  if (approverRole === "admin") {
    return userRole === "admin"
  }
  if (approverRole === "it_head") {
    // Allow admin, it_head, or department_head from IT department
    return userRole === "admin" || 
           userRole === "it_head" || 
           (userRole === "department_head" && userDepartment?.toLowerCase().includes("it"))
  }
  return false
}

export async function POST(request: NextRequest) {
  try {
    const { requisitionId, action, approvedBy, approvedById, approverRole, notes, approverSignature, userRole, userDepartment } = await request.json()

    if (!requisitionId || !action || !approvedBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!isAuthorizedForRole(approverRole, userRole, userDepartment)) {
      return NextResponse.json({ error: "Unauthorized to approve in this role" }, { status: 403 })
    }

    if (action === "approve" && !approverSignature) {
      return NextResponse.json({ error: "Digital signature is required for approval" }, { status: 400 })
    }

    const { data: requisition } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select()
      .eq("id", requisitionId)
      .single()

    if (!requisition) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const actingAsAdmin = approverRole === "admin"
    const approvedByUuid = isUuidLike(approvedById) ? approvedById : null
    const now = new Date().toISOString()

    const updateData: any = {
      updated_at: now,
    }

    if (actingAsAdmin) {
      updateData.admin_approved = action === "approve"
      updateData.admin_approved_by = approvedBy
      updateData.admin_approved_by_name = approvedBy
      updateData.admin_approved_at = now
      if (action === "approve" && approverSignature) {
        updateData.admin_signature = approverSignature
      }
      updateData.status = action === "approve" ? "pending_store" : "rejected_admin"
    } else {
      updateData.it_head_notes = notes
      updateData.it_head_approved = action === "approve"
      updateData.it_head_approved_by = approvedBy
      updateData.it_head_approved_by_name = approvedBy
      updateData.it_head_approved_at = now
      if (action === "approve" && approverSignature) {
        updateData.it_head_signature = approverSignature
      }
      updateData.status = action === "approve" ? "pending_admin" : "rejected_it_head"
    }

    const approvalChain = Array.isArray(requisition.approval_timeline)
      ? [...requisition.approval_timeline]
      : Array.isArray(requisition.approval_chain)
        ? [...requisition.approval_chain]
        : []
    approvalChain.push({
      approver: approvedBy,
      role: actingAsAdmin ? "admin" : "it_head",
      action,
      notes,
      timestamp: now,
      signature: action === "approve" ? !!approverSignature : undefined,
      signatureDataUrl: action === "approve" ? approverSignature : undefined,
    })
    updateData.approval_timeline = approvalChain

    let updated: any = null
    let updateError: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabaseAdmin
        .from("it_equipment_requisitions")
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
        const uuidByFields = ["it_head_approved_by", "admin_approved_by"]
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
      return NextResponse.json({ error: updateError.message || "Failed to update request" }, { status: 500 })
    }

    // Notify relevant parties
    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      recipient_id: action === "approve" ? "admin" : requisition.requested_by,
      recipient_type: action === "approve" ? "admin" : "staff",
      title: `IT Head ${action === "approve" ? "Approved" : "Rejected"} Requisition`,
      message: `Requisition ${requisition.requisition_number} was ${action === "approve" ? "approved and forwarded to Admin" : "rejected"}`,
      type: "it_form_update",
      related_id: requisitionId,
      related_type: "it_equipment_requisition",
      read: false,
    })

    if (notificationError) {
      console.error("[v0] Notification error:", notificationError)
    }

    return NextResponse.json({ success: true, requisition: updated })
  } catch (error) {
    console.error("[v0] API Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
