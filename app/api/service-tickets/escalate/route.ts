import { createClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key"),
)

export async function POST(request: NextRequest) {
  try {
    const {
      ticketId,
      escalateTo,
      escalationReason,
      itRequestFormUrl,
      currentAssignedUser,
      currentUserRole,
      currentUserLocation,
    } = await request.json()

    console.log("[v0] Escalating ticket:", ticketId, "to", escalateTo)

    // Validate input
    if (!ticketId || !escalateTo || !escalationReason) {
      return NextResponse.json(
        { error: "Missing required fields: ticketId, escalateTo, escalationReason" },
        { status: 400 }
      )
    }

    // Get the ticket details
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("service_tickets")
      .select("*")
      .eq("id", ticketId)
      .single()

    if (ticketError || !ticket) {
      console.error("[v0] Error fetching ticket:", ticketError)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Update the ticket status to escalated
    const { error: updateError } = await supabaseAdmin
      .from("service_tickets")
      .update({
        status: "escalated",
        escalated_to: escalateTo,
        escalation_reason: escalationReason,
        escalation_date: new Date().toISOString(),
        escalated_by: currentAssignedUser,
        escalated_by_role: currentUserRole,
        escalated_by_location: currentUserLocation,
        it_request_form_url: itRequestFormUrl,
      })
      .eq("id", ticketId)

    if (updateError) {
      console.error("[v0] Error updating ticket:", updateError)
      return NextResponse.json({ error: "Failed to escalate ticket" }, { status: 500 })
    }

    // Create escalation history record
    const { error: historyError } = await supabaseAdmin
      .from("ticket_escalation_history")
      .insert({
        ticket_id: ticketId,
        escalated_by: currentAssignedUser,
        escalated_by_role: currentUserRole,
        escalated_by_location: currentUserLocation,
        escalated_to: escalateTo,
        escalation_reason: escalationReason,
        it_request_form_url: itRequestFormUrl,
        escalation_date: new Date().toISOString(),
      })

    if (historyError) {
      console.warn("[v0] Could not record escalation history:", historyError)
    }

    // Create a ticket update record
    await supabaseAdmin
      .from("service_ticket_updates")
      .insert({
        ticket_id: ticketId,
        update_type: "escalation",
        old_status: ticket.status,
        new_status: "escalated",
        notes: `Ticket escalated to ${escalateTo}. Reason: ${escalationReason}`,
        created_by: currentAssignedUser,
        created_by_name: currentAssignedUser,
      })

    console.log("[v0] Ticket escalated successfully:", ticketId)

    return NextResponse.json({
      success: true,
      message: "Ticket escalated successfully",
      ticketId,
    })
  } catch (error) {
    console.error("[v0] Error escalating ticket:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
