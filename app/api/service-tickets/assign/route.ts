import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { ticketId, assigneeId, assignee, assigneeEmail, assigneePhone, priority, dueDate, instructions, assignedBy, assignedById, notifyEmail, notifySMS } = body

    console.log("[v0] Assigning ticket:", ticketId, "to:", assignee, "(ID:", assigneeId, ")")

    if (!ticketId || (!assignee && !assigneeId)) {
      console.error("[v0] Missing required fields - ticketId:", ticketId, "assignee:", assignee, "assigneeId:", assigneeId)
      return NextResponse.json(
        { success: false, error: "Ticket ID and assignee are required" },
        { status: 400 }
      )
    }

    // Update the service ticket with assignment info
    const updateData: Record<string, any> = {
      assigned_to: assigneeId, // Store user ID for querying
      assigned_to_name: assignee, // Store name for display
      status: "in_progress",
      priority: priority?.toLowerCase() || "medium",
      updated_at: new Date().toISOString(),
      assigned_at: new Date().toISOString(),
    }

    // Add due date if provided
    if (dueDate) {
      updateData.due_date = dueDate
    }

    // Add assigned by info
    if (assignedBy) {
      updateData.assigned_by = assignedBy
    }

    // Only query id if ticketId is a valid UUID, else use ticket_number
    function isUUID(str: string) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
    }

    let ticketData, findError, dbTicketId
    if (isUUID(ticketId)) {
      // Search by id (UUID)
      ({ data: ticketData, error: findError } = await supabaseAdmin
        .from("service_tickets")
        .select("id, ticket_number, title, description, location")
        .eq("id", ticketId)
        .limit(1)
      )
    } else {
      // Search by ticket_number (string)
      ({ data: ticketData, error: findError } = await supabaseAdmin
        .from("service_tickets")
        .select("id, ticket_number, title, description, location")
        .eq("ticket_number", ticketId)
        .limit(1)
      )
    }

    if (findError) {
      console.error("[v0] Error finding ticket:", findError)
      return NextResponse.json({ 
        success: false, 
        error: `Failed to find ticket: ${findError.message}` 
      }, { status: 500 })
    }

    if (!ticketData || ticketData.length === 0) {
      console.error("[v0] Ticket not found with ID:", ticketId)
      return NextResponse.json({ 
        success: false, 
        error: "Ticket not found. Please refresh and try again." 
      }, { status: 404 })
    }

    dbTicketId = ticketData[0].id

    // Update the ticket
    const { data, error } = await supabaseAdmin
      .from("service_tickets")
      .update(updateData)
      .eq("id", dbTicketId)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error assigning ticket:", error)
      return NextResponse.json({ 
        success: false, 
        error: `Failed to assign ticket: ${error.message}` 
      }, { status: 500 })
    }

    if (!data) {
      console.error("[v0] No data returned after assignment")
      return NextResponse.json({ 
        success: false, 
        error: "Assignment update failed - no data returned" 
      }, { status: 500 })
    }

    console.log("[v0] Ticket assigned successfully:", data)

    // Create a ticket update/audit entry using the correct table
    try {
      await supabaseAdmin
        .from("service_ticket_updates")
        .insert({
          ticket_id: dbTicketId,
          update_type: "assignment",
          old_status: ticketData[0]?.status || "open",
          new_status: "in_progress",
          new_assignee: assigneeId,
          notes: `Ticket assigned to ${assignee} by ${assignedBy}. Instructions: ${instructions || "None"}`,
          created_by: assignedById || assigneeId,
          created_by_name: assignedBy,
          is_internal: false,
        })
    } catch (updateError) {
      // History update may fail, but don't block the assignment
      console.warn("[v0] Could not record ticket update:", updateError)
    }

    // Create notification for assigned user
    if (assigneeId) {
      try {
        const ticketNumber = ticketData[0]?.ticket_number || ticketId
        const notificationTitle = `New Ticket Assigned: ${ticketNumber}`
        const notificationMessage = `You have been assigned ticket ${ticketNumber} by ${assignedBy}.${instructions ? ` Instructions: ${instructions}` : ''}`
        
        const { error: notifError } = await supabaseAdmin
          .from("notifications")
          .insert({
            user_id: assigneeId,
            title: notificationTitle,
            message: notificationMessage,
            type: "action_required",
            category: "ticket",
            reference_type: "service_ticket",
            reference_id: dbTicketId,
            reference_url: `/dashboard/assigned-tasks`,
            is_read: false,
            is_email_sent: notifyEmail || false,
            is_sms_sent: notifySMS || false,
          })
        
        if (notifError) {
          console.error("[v0] Error creating notification:", notifError)
        } else {
          console.log("[v0] Notification created for user:", assigneeId)
        }

        // Send email notification if requested
        if (notifyEmail && assigneeEmail) {
          console.log("[v0] Sending email notification to:", assigneeEmail)
          try {
            const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "ticket_assignment",
                to: assigneeEmail,
                subject: `New Ticket Assigned: ${ticketNumber}`,
                data: {
                  staffName: assignee,
                  ticketNumber: ticketNumber,
                  ticketTitle: ticketData[0]?.title || ticketData[0]?.description || "Service Request",
                  priority: priority || "medium",
                  dueDate: dueDate,
                  instructions: instructions,
                  assignedBy: assignedBy,
                  dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard/assigned-tasks`,
                },
              }),
            })
            
            const emailResult = await emailResponse.json()
            if (emailResult.success) {
              console.log("[v0] Email sent successfully to:", assigneeEmail)
              // Update notification to mark email as sent
              await supabaseAdmin
                .from("notifications")
                .update({ 
                  is_email_sent: true,
                  email_sent_at: new Date().toISOString()
                })
                .eq("user_id", assigneeId)
                .eq("reference_id", dbTicketId)
                .order("created_at", { ascending: false })
                .limit(1)
            } else {
              console.error("[v0] Failed to send email:", emailResult.error)
            }
          } catch (emailError) {
            console.error("[v0] Error sending email:", emailError)
          }
        }

        // TODO: Send SMS notification if notifySMS is true
        if (notifySMS && assigneePhone) {
          console.log("[v0] SMS notification requested for:", assigneePhone)
          // SMS sending logic would go here
        }
      } catch (notificationError) {
        console.error("[v0] Error handling notifications:", notificationError)
        // Don't fail the assignment if notification fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      ticket: data,
      message: `Ticket successfully assigned to ${assignee}`,
      assigned_to: assignee,
      assigned_at: data.assigned_at
    })
  } catch (error: any) {
    console.error("[v0] API Service Tickets Assign error:", error)
    return NextResponse.json({ 
      success: false, 
      error: error?.message || "Internal server error" 
    }, { status: 500 })
  }
}
