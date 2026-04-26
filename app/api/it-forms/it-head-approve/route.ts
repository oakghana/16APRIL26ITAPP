import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

function isHeadOfficeLocation(location: string | null | undefined): boolean {
  if (!location) return false
  const n = location.toLowerCase().replace(/[\s_-]+/g, "_").trim()
  return n === "head_office" || n === "head_office_accra" || n === "headoffice" ||
         n === "accra" || n.startsWith("head_office") || n === "ho"
}

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

function normalizeRole(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "_")
}

function normalizeApproverRole(value?: string | null) {
  const role = normalizeRole(value)
  if (role === "admin") return "admin"
  if (role === "it_head") return "it_head"
  if (role === "it_manager" || role === "regional_it_head" || role === "department_head") {
    return "it_head"
  }
  return "it_head"
}

export async function POST(request: NextRequest) {
  try {
    const { requisitionId, action, approvedBy, approvedById, approverRole, notes, approverSignature, userRole, userDepartment } = await request.json()

    const normalizedApproverRole = normalizeApproverRole(approverRole)
    const normalizedUserRole = normalizeRole(userRole)
    const normalizedUserDepartment = (userDepartment || "").trim().toLowerCase()

    if (!requisitionId || !action || !approvedBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!isAuthorizedForRole(normalizedApproverRole, normalizedUserRole, normalizedUserDepartment)) {
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

    // Determine requester location to decide routing (Head Office vs regional store)
    let requesterLocation: string | null = null
    const requesterId = isUuidLike(requisition.requested_by_id)
      ? requisition.requested_by_id
      : isUuidLike(requisition.created_by_id) ? requisition.created_by_id : null
    if (requesterId) {
      const { data: rProfile } = await supabaseAdmin
        .from("profiles")
        .select("location")
        .eq("id", requesterId)
        .single()
      requesterLocation = rProfile?.location || null
    }
    if (!requesterLocation && requisition.requested_by) {
      const { data: nameProfiles } = await supabaseAdmin
        .from("profiles")
        .select("location")
        .ilike("full_name", requisition.requested_by)
        .limit(1)
      requesterLocation = nameProfiles?.[0]?.location || null
    }
    const isHeadOfficeReq = isHeadOfficeLocation(requesterLocation)
    // Head Office → pending_store (store head issues directly)
    // Regional     → pending_regional_store (regional IT head adds to local stock, then assigns)
    const approvedStoreStatus = isHeadOfficeReq ? "pending_store" : "pending_regional_store"

    const actingAsAdmin = normalizedApproverRole === "admin"
    const approvedByUuid = isUuidLike(approvedById) ? approvedById : null
    const approverIdValue = approvedByUuid || approvedBy
    const now = new Date().toISOString()
    const hasColumn = (column: string) => Object.prototype.hasOwnProperty.call(requisition, column)

    const updateData: any = {
      updated_at: now,
    }

    if (actingAsAdmin) {
      if (hasColumn("admin_approved")) {
        updateData.admin_approved = action === "approve"
      }
      if (hasColumn("admin_approved_by")) {
        updateData.admin_approved_by = approverIdValue
      }
      if (hasColumn("admin_approved_by_name")) {
        updateData.admin_approved_by_name = approvedBy
      }
      if (hasColumn("admin_approved_at")) {
        updateData.admin_approved_at = now
      }
      if (action === "approve" && approverSignature && hasColumn("admin_signature")) {
        updateData.admin_signature = approverSignature
      }
      updateData.status = action === "approve" ? approvedStoreStatus : "rejected_admin"
    } else {
      if (hasColumn("it_head_notes")) {
        updateData.it_head_notes = notes
      }
      if (hasColumn("it_head_approved")) {
        updateData.it_head_approved = action === "approve"
      }
      if (hasColumn("it_head_approved_by")) {
        updateData.it_head_approved_by = approverIdValue
      }
      if (hasColumn("it_head_approved_by_name")) {
        updateData.it_head_approved_by_name = approvedBy
      }
      if (hasColumn("it_head_approved_at")) {
        updateData.it_head_approved_at = now
      }
      if (action === "approve" && approverSignature && hasColumn("it_head_signature")) {
        updateData.it_head_signature = approverSignature
      }
      if (action === "approve") {
        // Business rule: IT Head/Manager approval is final for this stage; no extra admin approval gate.
        if (hasColumn("admin_approved")) {
          updateData.admin_approved = true
        }
        if (hasColumn("admin_approved_by")) {
          updateData.admin_approved_by = approverIdValue
        }
        if (hasColumn("admin_approved_by_name")) {
          updateData.admin_approved_by_name = approvedBy
        }
        if (hasColumn("admin_approved_at")) {
          updateData.admin_approved_at = now
        }
        if (approverSignature && hasColumn("admin_signature")) {
          updateData.admin_signature = approverSignature
        }
        updateData.status = approvedStoreStatus
        // Flag for UI to render correct approval stages
        if (hasColumn("regional_fulfillment") || true) {
          updateData.regional_fulfillment = !isHeadOfficeReq
          updateData.requester_location = requesterLocation
        }
      } else {
        updateData.status = "rejected_it_head"
      }
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
    if (hasColumn("approval_timeline") || hasColumn("approval_chain")) {
      updateData.approval_timeline = approvalChain
    }

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
    if (action === "approve" && !isHeadOfficeReq) {
      // Regional approval: notify regional IT heads at the requester's location
      const { data: regionalHeads } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "regional_it_head")
        .eq("is_active", true)
      if (regionalHeads && regionalHeads.length > 0) {
        const regionalNotifications = regionalHeads.map((rh: any) => ({
          user_id: rh.id,
          title: "Regional IT Equipment Requisition Ready",
          message: `Requisition ${requisition.requisition_number} has been approved by IT Head and is ready for regional stock assignment at ${requesterLocation || "your location"}.`,
          type: "info",
          category: "approval",
          reference_type: "it_equipment_requisition",
          reference_id: requisitionId,
          is_read: false,
        }))
        await supabaseAdmin.from("notifications").insert(regionalNotifications).catch(console.error)
      }
    } else {
      const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
        recipient_id: action === "approve" ? "admin" : requisition.requested_by,
        recipient_type: action === "approve" ? "admin" : "staff",
        title: `IT Head ${action === "approve" ? "Approved" : "Rejected"} Requisition`,
        message: `Requisition ${requisition.requisition_number} was ${action === "approve" ? "approved and forwarded to Store" : "rejected"}`,
        type: "it_form_update",
        related_id: requisitionId,
        related_type: "it_equipment_requisition",
        read: false,
      })
      if (notificationError) console.error("[v0] Notification error:", notificationError)
    }

    return NextResponse.json({ success: true, requisition: updated })
  } catch (error) {
    console.error("[v0] API Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
