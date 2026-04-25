import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: NextRequest) {
  try {
    const { requisitionId, action, processedBy, processedById, processedByLocation, notes, formType = "requisition" } = await request.json()

    const config = FORM_CONFIG[formType as FormType]
    if (!config) {
      return NextResponse.json({ error: "Unsupported form type" }, { status: 400 })
    }

    if (!requisitionId || !action || !processedBy || !notes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (!["process", "hold"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Get the current requisition
    const { data: requisition, error: fetchError } = await supabaseAdmin
      .from(config.table)
      .select()
      .eq("id", requisitionId)
      .single()

    if (fetchError) {
      console.error("[v0] Error fetching requisition:", fetchError)
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      )
    }

    // Update the requisition
    const nowIso = new Date().toISOString()
    const updateData: any = {
      updated_at: nowIso,
    }

    if (formType === "requisition") {
      updateData.service_desk_notes = notes
      updateData.service_desk_processed_by = processedBy
      updateData.service_desk_processed_at = nowIso
    } else {
      updateData.confirmed_by = processedBy
      updateData.confirmed_date = nowIso.split("T")[0]
      updateData.other_comments = [
        requisition.other_comments,
        `IT Office Use ${action === "process" ? "completed" : "hold"} note: ${notes}`,
      ]
        .filter(Boolean)
        .join("\n")
    }

    if (action === "process") {
      if (formType === "requisition") {
        updateData.service_desk_approved = true
        updateData.status = "pending_it_head"
      } else {
        updateData.status = "pending_manager"
      }
    } else if (action === "hold") {
      updateData.status = formType === "requisition" ? "hold_it_office_use" : "hod_approved"
    }

    // Only write approval_timeline when that column exists on the underlying table.
    const hasApprovalTimelineColumn = Object.prototype.hasOwnProperty.call(requisition, "approval_timeline")
    if (hasApprovalTimelineColumn) {
      const existingTimeline = Array.isArray(requisition.approval_timeline)
        ? requisition.approval_timeline
        : Array.isArray(requisition.approval_chain)
          ? requisition.approval_chain
          : []
      const approvalChain = [...existingTimeline]
      approvalChain.push({
        approver: processedBy,
        approverId: processedById || null,
        location: processedByLocation || null,
        role: "it_office_use",
        action: action,
        notes: notes,
        timestamp: nowIso,
      })
      updateData.approval_timeline = approvalChain
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from(config.table)
      .update(updateData)
      .eq("id", requisitionId)
      .select()
      .single()

    if (updateError) {
      console.error("[v0] Error updating requisition:", updateError)
      return NextResponse.json(
        { error: "Failed to update requisition" },
        { status: 500 }
      )
    }

    // Create notifications
    if (action === "process") {
      try {
        const requestNumber = requisition?.[config.numberField] || requisitionId

        const { data: managerUsers, error: managerQueryError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .or("role.eq.admin,role.eq.it_head,and(role.eq.department_head,department.ilike.%it%)")
          .eq("is_active", true)

        if (managerQueryError) {
          console.error("[v0] Error loading manager users for notifications:", managerQueryError)
        }

        if (managerUsers && managerUsers.length > 0) {
          const managerNotifications = managerUsers.map((manager) => ({
            user_id: manager.id,
            title: "Request Ready for IT Head/Admin Review",
            message: `Request ${requestNumber} has completed IT office-use processing and is ready for final review.`,
            type: "info" as const,
            category: "approval" as const,
            reference_type: config.relatedType,
            reference_id: requisitionId,
            is_read: false,
          }))

          const { error: managerNotifyError } = await supabaseAdmin
            .from("notifications")
            .insert(managerNotifications)

          if (managerNotifyError) {
            console.error("[v0] Error creating manager notifications:", managerNotifyError)
          }
        }

        const { error: requesterNotifyError } = await supabaseAdmin.from("notifications").insert({
          recipient_id: requisition.requested_by_id || null,
          recipient_type: "staff",
          title: "Your Request Completed IT Office Use",
          message: `Your request ${requestNumber} has completed IT office-use checks and is now awaiting IT Head/Admin review.`,
          type: "it_form_update",
          related_id: requisitionId,
          related_type: config.relatedType,
          read: false,
        })

        if (requesterNotifyError) {
          console.error("[v0] Error creating requester notification:", requesterNotifyError)
        }
      } catch (notificationError) {
        console.error("[v0] Non-blocking notification error in office-use processing:", notificationError)
      }
    }

    return NextResponse.json({
      success: true,
      requisition: updated,
    })
  } catch (error) {
    console.error("[v0] API Error in service desk processing:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
