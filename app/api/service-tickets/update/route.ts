import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role key to bypass RLS
const supabaseAdmin = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key"))

export async function PATCH(request: NextRequest) {
  try {
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
      // Completion submission goes to awaiting_confirmation first.
      completed: "awaiting_confirmation",
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
      updateData.completed_at = completed_at || new Date().toISOString()
      updateData.completion_confirmed = false
      updateData.completion_confirmed_at = null
      updateData.completion_confirmed_by = null
      updateData.completion_confirmed_by_name = null
      updateData.completion_work_notes = work_notes || null
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

    // Create notification for requester when ticket awaits confirmation
    if (status === "completed" && data.requester_id) {
      try {
        const notificationData = {
          user_id: data.requester_id,
          type: "task_completed",
          title: "Service Ticket Needs Confirmation",
          message: `IT staff marked "${data.title || data.subject || 'Service Request'}" as done. Please confirm before final completion.`,
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
