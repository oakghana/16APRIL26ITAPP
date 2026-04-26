import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      repairTaskId,
      status,
      actualCost,
      notes,
      workCompletedAt,
      confirmedBy,
    } = body

    if (!repairTaskId || !status) {
      return NextResponse.json(
        { error: "repairTaskId and status are required" },
        { status: 400 }
      )
    }

    const validStatuses = ["pending", "assigned", "in_transit", "awaiting_parts", "quality_check", "in_progress", "completed", "returned", "cancelled"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    // Update repair task
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === "in_progress" && !workStartedAt) {
      updateData.work_started_at = new Date().toISOString()
    }

    if (status === "completed") {
      updateData.work_completed_at = workCompletedAt || new Date().toISOString()
      updateData.actual_cost = actualCost ? parseFloat(actualCost) : null
    }

    if (status === "returned" || status === "completed") {
      updateData.confirmed_by = confirmedBy
      updateData.confirmed_at = new Date().toISOString()
    }

    if (notes) {
      updateData.notes = notes
    }

    // Get previous data for audit trail
    const { data: previousData } = await supabaseAdmin
      .from("repair_tasks")
      .select()
      .eq("id", repairTaskId)
      .single()

    const { data: repairTask, error: updateError } = await supabaseAdmin
      .from("repair_tasks")
      .update(updateData)
      .eq("id", repairTaskId)
      .select()
      .single()

    if (updateError) {
      console.error("[v0] Error updating repair task:", updateError)
      return NextResponse.json(
        { error: "Failed to update repair task" },
        { status: 500 }
      )
    }

    // Update status_history JSON field with complete audit trail
    const statusHistory = previousData?.status_history || []
    const newHistoryEntry = {
      timestamp: new Date().toISOString(),
      status,
      previous_status: previousData?.status,
      changed_by: confirmedBy || "system",
      notes,
      actual_cost: actualCost,
      work_started_at: status === "in_progress" ? updateData.work_started_at : null,
      work_completed_at: status === "completed" ? updateData.work_completed_at : null,
    }

    await supabaseAdmin
      .from("repair_tasks")
      .update({
        status_history: [...statusHistory, newHistoryEntry],
      })
      .eq("id", repairTaskId)
      .catch((err) => console.error("[v0] Error updating status_history:", err))

    // Update device status if repair is completed or returned
    if (status === "returned" || status === "completed") {
      await supabaseAdmin
        .from("devices")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", repairTask.device_id)
    }

    // Create cross-portal notifications
    try {
      const notificationMessages: any[] = []

      // Notify IT Head/Admin of status change
      notificationMessages.push({
        recipient_type: "it_head",
        recipient_id: "admin",
        title: `Repair Task Status Updated: ${status.replace(/_/g, " ")}`,
        message: `Repair ${previousData?.task_number || repairTask.id} status changed to ${status.replace(/_/g, " ")}`,
        type: "repair_status_change",
        related_id: repairTaskId,
        related_type: "repair_request",
        read: false,
      })

      // Notify IT Staff of status change
      if (previousData?.location) {
        notificationMessages.push({
          recipient_type: "it_staff",
          recipient_id: previousData.location,
          title: `Repair Task Status Updated`,
          message: `Device repair status: ${status.replace(/_/g, " ")}`,
          type: "repair_status_change",
          related_id: repairTaskId,
          related_type: "repair_request",
          read: false,
        })
      }

      // Notify Regional Heads if applicable
      if (previousData?.location && previousData?.location.includes("regional")) {
        notificationMessages.push({
          recipient_type: "regional_it_head",
          recipient_id: previousData.location,
          title: `Repair Task Update`,
          message: `Regional repair task status: ${status.replace(/_/g, " ")}`,
          type: "repair_status_change",
          related_id: repairTaskId,
          related_type: "repair_request",
          read: false,
        })
      }

      // Notify Service Provider
      if (previousData?.service_provider_id) {
        notificationMessages.push({
          recipient_type: "service_provider",
          recipient_id: previousData.service_provider_id,
          title: `Your Repair Task Status Changed`,
          message: `Repair task for ${previousData?.device_name} is now: ${status.replace(/_/g, " ")}`,
          type: "repair_status_change",
          related_id: repairTaskId,
          related_type: "repair_request",
          read: false,
        })
      }

      // Batch insert notifications
      if (notificationMessages.length > 0) {
        const now = new Date().toISOString()
        const { error: notificationInsertError } = await supabaseAdmin
          .from("notifications")
          .insert(
            notificationMessages.map((notif) => ({
              ...notif,
              created_at: now,
            }))
          )

        if (notificationInsertError) {
          console.error("[v0] Error creating cross-portal notifications:", notificationInsertError)
          // Don't fail the status update if notifications fail
        }
      }
    } catch (err) {
      console.error("[v0] Error in notification creation:", err)
      // Don't fail the update if notifications fail
    }

    return NextResponse.json({
      success: true,
      message: `Repair status updated to ${status}`,
      task: repairTask,
    })
  } catch (error: any) {
    console.error("[v0] Error in repair confirm API:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
