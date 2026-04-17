import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

// Use service role key to bypass RLS
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getServerSupabase()
    const body = await request.json()
    const { id, status, work_notes, actual_hours, completed_at } = body

    if (!id) {
      return NextResponse.json({ error: "Ticket ID is required" }, { status: 400 })
    }

    console.log("[v0] Updating service ticket:", id, { status, work_notes, actual_hours })

    // Map task status to service ticket status
    const statusMap: Record<string, string> = {
      assigned: "open",
      in_progress: "in_progress",
      completed: "resolved",
      // DB enum may not include 'on_hold' in some deployments; map to 'open' to avoid invalid enum errors.
      // Proper hold flow should use the /hold endpoint which sets hold metadata.
      on_hold: "open",
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

    if (actual_hours !== undefined) {
      updateData.actual_hours = actual_hours
    }

    if (completed_at || status === "completed") {
      updateData.resolved_at = completed_at || new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from("service_tickets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating service ticket:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Updated service ticket:", data)

    // Create notification for requester when ticket is completed
    if (status === "completed" && data.requester_id) {
      try {
        const notificationData = {
          user_id: data.requester_id,
          type: "task_completed",
          title: "Service Ticket Resolved",
          message: `Your service ticket "${data.title || data.subject || 'Service Request'}" has been resolved`,
          related_id: data.id,
          related_type: "service_ticket",
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

    return NextResponse.json({ success: true, ticket: data })
  } catch (error) {
    console.error("[v0] API Service Tickets Update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
