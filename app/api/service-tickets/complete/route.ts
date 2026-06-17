import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ticketId, completedBy, completedByName, completedByRole, workNotes } = body

    if (!ticketId) {
      return NextResponse.json(
        { error: "Missing ticket ID" },
        { status: 400 }
      )
    }

    // Get current ticket info - support either UUID or ticket number in case
    // the frontend accidentally passed the human-readable number.
    let ticket
    let fetchError

    // attempt simple lookup by id first, then fall back to ticket_number
    ({ data: ticket, error: fetchError } = await supabase
      .from("service_tickets")
      .select("*")
      .or(`id.eq.${ticketId},ticket_number.eq.${ticketId}`)
      .single())

    if (fetchError || !ticket) {
      console.warn("[v0] Complete route could not find ticket", ticketId, fetchError)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Mark ticket as waiting for requester confirmation.
    // Do NOT mark as resolved here; requester must confirm first.
    // Set awaiting_confirmation_since for auto-confirmation tracking (30 minutes timeout)
    const baseUpdate: Record<string, any> = {
      status: "awaiting_confirmation",
      completed_at: new Date().toISOString(),
      completed_by: completedBy,
      completed_by_name: completedByName,
      completed_by_role: completedByRole,
      completion_work_notes: workNotes,
      completion_confirmed: false,
      completion_confirmed_at: null,
      completion_confirmed_by: null,
      completion_confirmed_by_name: null,
      awaiting_confirmation_since: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Try with auto_confirmed first; if column missing, retry without it
    let data: any = null
    let error: any = null

    for (const updatePayload of [
      { ...baseUpdate, auto_confirmed: false },
      baseUpdate,
    ]) {
      const result = await supabase
        .from("service_tickets")
        .update(updatePayload)
        .eq("id", ticket.id)
        .select()
        .single()
      data = result.data
      error = result.error

      if (!error) break

      const msg = String(error.message || "")
      const isColumnMissing =
        error.code === "42703" ||
        /column .* does not exist/i.test(msg) ||
        /schema cache/i.test(msg)
      if (!isColumnMissing) break
      console.warn("[v0] auto_confirmed column missing, retrying without it")
    }

    if (error) {
      console.error("Error marking ticket as completed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the completion action
    await supabase.from("audit_logs").insert({
      action: "ticket_completion_submitted",
      table_name: "service_tickets",
      record_id: ticketId,
      user_id: completedBy,
      user_name: completedByName,
      details: {
        status: "awaiting_user_confirmation",
        work_notes: workNotes,
      },
      created_at: new Date().toISOString(),
    })

    // Notify the requester (or service desk head if they raised it) to confirm completion.
    try {
      let requesterProfile: any = null

      if (ticket.requester_email) {
        const { data: byEmail } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("email", ticket.requester_email)
          .maybeSingle()
        requesterProfile = byEmail
      }

      if (!requesterProfile && ticket.requested_by) {
        const { data: byName } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .ilike("full_name", ticket.requested_by)
          .maybeSingle()
        requesterProfile = byName
      }

      if (requesterProfile?.id) {
        await supabase.from("notifications").insert({
          user_id: requesterProfile.id,
          type: "task_completed",
          title: "Ticket Needs Your Confirmation",
          message: `IT staff marked ticket \"${ticket.title || ticket.ticket_number || "Service Request"}\" as done. Please confirm before it is counted as completed.`,
          related_id: ticket.id,
          related_type: "service_ticket",
          priority: "high",
          is_read: false,
          created_at: new Date().toISOString(),
        })
      }
    } catch (notifyError) {
      console.error("[v0] Failed to create requester confirmation notification:", notifyError)
    }

    return NextResponse.json({
      success: true,
      ticket: data,
      message: "Submitted for requester confirmation. Final completion and performance credit happen after requester/service desk head confirmation.",
    })
  } catch (error) {
    console.error("Error in complete endpoint:", error)
    return NextResponse.json({ error: "Failed to mark ticket as completed" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { ticketId, confirmedBy, confirmedByName, confirmedByRole, confirmation, confirmationNotes } = body

    if (!ticketId) {
      return NextResponse.json(
        { error: "Missing ticket ID" },
        { status: 400 }
      )
    }

    // Load ticket to enforce who can confirm.
    const { data: ticket, error: ticketError } = await supabase
      .from("service_tickets")
      .select("id, status, requested_by, requester_email, completed_by, assigned_to, title, ticket_number")
      .eq("id", ticketId)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    if (ticket.status !== "awaiting_confirmation") {
      return NextResponse.json({ error: "Ticket is not awaiting confirmation" }, { status: 400 })
    }

    const normalize = (v: string | null | undefined) => (v || "").toLowerCase().trim()
    const requesterName = normalize(ticket.requested_by)
    const confirmerName = normalize(confirmedByName)

    // Confirmation must come from the requester.
    // If ticket was raised by service desk head, the same service desk head confirms.
    const isRequesterConfirming = requesterName && requesterName === confirmerName

    if (!isRequesterConfirming) {
      return NextResponse.json(
        {
          error: "Only the original requester can confirm completion for this ticket.",
          expectedConfirmer: ticket.requested_by || null,
        },
        { status: 403 }
      )
    }

    const finalStatus = confirmation === "approved" ? "resolved" : "reopen"

    // Update ticket with user confirmation
    const { data, error } = await supabase
      .from("service_tickets")
      .update({
        status: finalStatus,
        user_confirmed: true,
        user_confirmed_at: new Date().toISOString(),
        user_confirmed_by: confirmedBy,
        completion_confirmed: confirmation === "approved",
        completion_confirmed_at: confirmation === "approved" ? new Date().toISOString() : null,
        completion_confirmed_by: confirmation === "approved" ? confirmedBy : null,
        completion_confirmed_by_name: confirmation === "approved" ? confirmedByName : null,
        confirmation_status: confirmation,
        confirmation_notes: confirmationNotes,
        completion_confirmation_notes: confirmationNotes,
        resolved_at: confirmation === "approved" ? new Date().toISOString() : null,
        awaiting_confirmation_since: null, // Clear the auto-confirm timer
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select()
      .single()

    if (error) {
      console.error("Error confirming ticket completion:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the confirmation action
    await supabase.from("audit_logs").insert({
      action: "ticket_user_confirmed",
      table_name: "service_tickets",
      record_id: ticketId,
      user_id: confirmedBy,
      user_name: confirmedByName,
      details: {
        confirmation: confirmation,
        notes: confirmationNotes,
        final_status: finalStatus,
      },
      created_at: new Date().toISOString(),
    })

    // Notify IT staff who submitted/completed the work so they get a toast immediately.
    try {
      const targetStaffId = ticket.completed_by || ticket.assigned_to || null
      if (targetStaffId) {
        await supabase.from("notifications").insert({
          user_id: targetStaffId,
          type: confirmation === "approved" ? "task_confirmed" : "task_rejected",
          title: confirmation === "approved" ? "Work Confirmed" : "Work Needs Rework",
          message:
            confirmation === "approved"
              ? `Your work on \"${ticket.title || ticket.ticket_number || "Service Request"}\" was confirmed by requester.`
              : `Requester rejected completion for \"${ticket.title || ticket.ticket_number || "Service Request"}\". Please review notes and rework.`,
          related_id: ticket.id,
          related_type: "service_ticket",
          priority: confirmation === "approved" ? "normal" : "high",
          is_read: false,
          created_at: new Date().toISOString(),
        })
      }
    } catch (notifyError) {
      console.error("[v0] Failed to notify IT staff after requester confirmation:", notifyError)
    }

    return NextResponse.json({ success: true, ticket: data })
  } catch (error) {
    console.error("Error in confirmation endpoint:", error)
    return NextResponse.json({ error: "Failed to confirm ticket" }, { status: 500 })
  }
}
