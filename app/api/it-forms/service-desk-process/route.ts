import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: NextRequest) {
  try {
    const { requisitionId, action, processedBy, processedById, processedByLocation, notes } = await request.json()

    if (!requisitionId || !action || !processedBy || !notes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Get the current requisition
    const { data: requisition, error: fetchError } = await supabaseAdmin
      .from("it_equipment_requisitions")
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
    const updateData: any = {
      service_desk_notes: notes,
      service_desk_processed_by: processedBy,
      service_desk_processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (action === "process") {
      updateData.service_desk_approved = true
      updateData.status = "pending_it_head"
    } else if (action === "hold") {
      updateData.status = "hold_it_office_use"
    }

    // Update the approval chain
    const approvalChain = requisition.approval_timeline || requisition.approval_chain || []
    approvalChain.push({
      approver: processedBy,
      approverId: processedById || null,
      location: processedByLocation || null,
      role: "it_office_use",
      action: action,
      notes: notes,
      timestamp: new Date().toISOString(),
    })
    updateData.approval_timeline = approvalChain

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("it_equipment_requisitions")
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
      const { data: managerUsers } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .or("role.eq.admin,role.eq.it_head,and(role.eq.department_head,department.ilike.%it%)")
        .eq("is_active", true)

      if (managerUsers && managerUsers.length > 0) {
        const managerNotifications = managerUsers.map((manager) => ({
          user_id: manager.id,
          title: "Request Ready for IT Head/Admin Review",
          message: `Requisition ${requisition.requisition_number} has completed IT office-use processing and is ready for final review.`,
          type: "info" as const,
          category: "approval" as const,
          reference_type: "it_equipment_requisition",
          reference_id: requisitionId,
          is_read: false,
        }))

        await supabaseAdmin
          .from("notifications")
          .insert(managerNotifications)
          .catch((err) => console.error("[v0] Error creating manager notifications:", err))
      }

      // Notify requester
      await supabaseAdmin.from("notifications").insert({
        recipient_id: requisition.requested_by,
        recipient_type: "staff",
        title: "Your Request Completed IT Office Use",
        message: `Your IT equipment requisition ${requisition.requisition_number} has completed IT office-use checks and is now awaiting IT Head/Admin review.`,
        type: "it_form_update",
        related_id: requisitionId,
        related_type: "it_equipment_requisition",
        read: false,
      }).catch(err => console.error("[v0] Error creating notification:", err))
    }

    return NextResponse.json({
      success: true,
      requisition: updated,
    })
  } catch (error) {
    console.error("[v0] API Error in service desk processing:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
