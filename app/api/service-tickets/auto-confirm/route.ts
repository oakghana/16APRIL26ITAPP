import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: Request) {
  try {
    // This endpoint is called by a scheduled task/cron job to auto-confirm
    // tickets that have been in awaiting_confirmation status for more than 30 minutes
    
    const now = new Date()
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)

    // Find all tickets that are awaiting_confirmation for more than 30 minutes
    // Try filtering by auto_confirmed first; if column is missing fall back to status+time only
    let ticketsToAutoConfirm: any[] | null = null
    let fetchError: any = null

    for (const queryBuilder of [
      () => supabase
        .from("service_tickets")
        .select("*")
        .eq("status", "awaiting_confirmation")
        .eq("auto_confirmed", false)
        .lte("awaiting_confirmation_since", thirtyMinutesAgo.toISOString()),
      () => supabase
        .from("service_tickets")
        .select("*")
        .eq("status", "awaiting_confirmation")
        .lte("awaiting_confirmation_since", thirtyMinutesAgo.toISOString()),
    ]) {
      const result = await queryBuilder()
      ticketsToAutoConfirm = result.data
      fetchError = result.error

      if (!fetchError) break

      const msg = String(fetchError.message || "")
      const isColMissing =
        fetchError.code === "42703" ||
        /column .* does not exist/i.test(msg) ||
        /schema cache/i.test(msg)
      if (!isColMissing) break
      console.warn("[v0] auto_confirmed column missing in auto-confirm fetch, retrying without it")
    }

    if (fetchError) {
      console.error("[v0] Error fetching tickets for auto-confirmation:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!ticketsToAutoConfirm || ticketsToAutoConfirm.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tickets eligible for auto-confirmation",
        count: 0,
      })
    }

    console.log(
      `[v0] Found ${ticketsToAutoConfirm.length} tickets eligible for auto-confirmation`
    )

    // Auto-confirm all eligible tickets
    const ticketIds = ticketsToAutoConfirm.map((t) => t.id)

    const baseAutoConfirmUpdate: Record<string, any> = {
      status: "resolved",
      completion_confirmed: true,
      completion_confirmed_at: now.toISOString(),
      completion_confirmed_by: "system",
      completion_confirmed_by_name: "System Auto-Confirmation",
      resolved_at: now.toISOString(),
      updated_at: now.toISOString(),
    }

    let updateError: any = null
    for (const updatePayload of [
      { ...baseAutoConfirmUpdate, auto_confirmed: true },
      baseAutoConfirmUpdate,
    ]) {
      const result = await supabase
        .from("service_tickets")
        .update(updatePayload)
        .in("id", ticketIds)
      updateError = result.error

      if (!updateError) break

      const msg = String(updateError.message || "")
      const isColMissing =
        updateError.code === "42703" ||
        /column .* does not exist/i.test(msg) ||
        /schema cache/i.test(msg)
      if (!isColMissing) break
      console.warn("[v0] auto_confirmed column missing in auto-confirm update, retrying without it")
    }

    if (updateError) {
      console.error("[v0] Error auto-confirming tickets:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log auto-confirmation actions for each ticket
    try {
      const auditLogs = ticketsToAutoConfirm.map((ticket) => ({
        action: "ticket_auto_confirmed",
        table_name: "service_tickets",
        record_id: ticket.id,
        user_id: "system",
        user_name: "System Auto-Confirmation",
        details: {
          reason: "Auto-confirmed after 30 minutes without requester confirmation",
          completed_by: ticket.completed_by_name,
          awaiting_since: ticket.awaiting_confirmation_since,
        },
        created_at: now.toISOString(),
      }))

      await supabase.from("audit_logs").insert(auditLogs)
    } catch (auditError) {
      console.error("[v0] Failed to log auto-confirmation:", auditError)
    }

    // Notify IT staff and requester about auto-confirmation
    try {
      const notifications = ticketsToAutoConfirm.flatMap((ticket) => {
        const notifs = []

        // Notify IT staff who completed the work
        if (ticket.completed_by) {
          notifs.push({
            user_id: ticket.completed_by,
            type: "task_auto_confirmed",
            title: "Work Auto-Confirmed",
            message: `Your work on \"${ticket.title || ticket.ticket_number || "Service Request"}\" was automatically confirmed after 30 minutes without requester confirmation.`,
            related_id: ticket.id,
            related_type: "service_ticket",
            priority: "normal",
            is_read: false,
            created_at: now.toISOString(),
          })
        }

        // Notify requester
        notifs.push({
          user_id: ticket.requested_by, // This might be a username, not UUID - may need adjustment
          type: "task_auto_confirmed",
          title: "Your Request Completed",
          message: `Your service request \"${ticket.title || ticket.ticket_number || "Service Request"}\" was automatically confirmed as complete after 30 minutes.`,
          related_id: ticket.id,
          related_type: "service_ticket",
          priority: "normal",
          is_read: false,
          created_at: now.toISOString(),
        })

        return notifs
      })

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications)
      }
    } catch (notifyError) {
      console.error("[v0] Failed to create notifications for auto-confirmed tickets:", notifyError)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully auto-confirmed ${ticketsToAutoConfirm.length} ticket(s)`,
      count: ticketsToAutoConfirm.length,
      ticketIds: ticketIds,
    })
  } catch (error) {
    console.error("[v0] Error in auto-confirm endpoint:", error)
    return NextResponse.json({ error: "Failed to auto-confirm tickets" }, { status: 500 })
  }
}

// GET endpoint for monitoring/testing
export async function GET(request: Request) {
  try {
    const now = new Date()
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)

    // Get count of tickets eligible for auto-confirmation
    // Try with auto_confirmed filter first; fall back if column doesn't exist yet
    let tickets: any[] | null = null
    let error: any = null

    for (const queryBuilder of [
      () => supabase
        .from("service_tickets")
        .select("id, ticket_number, title, awaiting_confirmation_since")
        .eq("status", "awaiting_confirmation")
        .eq("auto_confirmed", false)
        .lte("awaiting_confirmation_since", thirtyMinutesAgo.toISOString()),
      () => supabase
        .from("service_tickets")
        .select("id, ticket_number, title, awaiting_confirmation_since")
        .eq("status", "awaiting_confirmation")
        .lte("awaiting_confirmation_since", thirtyMinutesAgo.toISOString()),
    ]) {
      const result = await queryBuilder()
      tickets = result.data
      error = result.error

      if (!error) break

      const msg = String(error.message || "")
      const isColMissing =
        error.code === "42703" ||
        /column .* does not exist/i.test(msg) ||
        /schema cache/i.test(msg)
      if (!isColMissing) break
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      status: "ok",
      eligibleCount: tickets?.length || 0,
      tickets: tickets || [],
      threshold: thirtyMinutesAgo.toISOString(),
      currentTime: now.toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error in auto-confirm GET:", error)
    return NextResponse.json({ error: "Failed to check auto-confirmation status" }, { status: 500 })
  }
}
