import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

// Use service role key to bypass RLS
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const body = await request.json()
    const { id, status, work_notes, notes, actual_hours, completed_at, scheduled_pickup_date } = body

    if (!id) {
      return NextResponse.json({ error: "Repair request ID is required" }, { status: 400 })
    }

    console.log("[v0] Updating repair request:", id, { status, work_notes, actual_hours, scheduled_pickup_date })

    // Map task status to repair request status
    const statusMap: Record<string, string> = {
      assigned: "assigned",
      pickup_scheduled: "pickup_scheduled",
      collected: "collected",
      in_progress: "in_progress",
      in_repair: "in_repair",
      completed: "completed",
      on_hold: "on_hold",
      returned: "returned",
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (status) {
      updateData.status = statusMap[status] || status
    }

    if (work_notes) {
      updateData.work_notes = work_notes
    }

    if (notes) {
      updateData.notes = notes
    }

    if (actual_hours !== undefined) {
      updateData.actual_hours = actual_hours
    }

    if (scheduled_pickup_date) {
      updateData.scheduled_pickup_date = scheduled_pickup_date
    }

    if (completed_at || status === "completed") {
      updateData.completed_at = completed_at || new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating repair request:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Updated repair request:", data)

    // Create notification for requester when task is completed
    if (status === "completed" && data.requested_by) {
      try {
        const notificationData = {
          user_id: data.requested_by,
          type: "task_completed",
          title: "Repair Task Completed",
          message: `Your repair request "${data.issue_description || data.description || 'Repair Task'}" has been completed`,
          related_id: data.id,
          related_type: "repair_request",
          priority: "high",
          read: false,
          created_at: new Date().toISOString(),
        }

        await supabaseAdmin.from("notifications").insert(notificationData)
        console.log("[v0] Created completion notification for requester")
      } catch (notifError) {
        console.error("[v0] Error creating notification:", notifError)
        // Don't fail the main request if notification fails
      }
    }

    return NextResponse.json({ success: true, repair: data })
  } catch (error) {
    console.error("[v0] API Repairs Update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
