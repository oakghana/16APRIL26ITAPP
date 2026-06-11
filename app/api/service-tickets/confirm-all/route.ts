import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

export async function POST(request: NextRequest) {
  try {
    // Extract user ID from request body
    const body = await request.json().catch(() => ({}))
    const { userId, userName, userRole } = body

    console.log("[v0] confirm-all POST - received body:", { userId, userName, userRole })

    if (!userId) {
      console.error("[v0] confirm-all - missing userId")
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    // Fetch user profile to check role
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()

    console.log("[v0] confirm-all - profile lookup:", { userId, profileError: profileError?.message, role: userProfile?.role })

    // Allow admin, IT head, regional IT head, and service desk head to bulk confirm
    const allowedRoles = ["admin", "it_head", "regional_it_head", "service_desk_head"]
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      console.error("[v0] Unauthorized confirm-all attempt:", { userId, userRole, profileRole: userProfile?.role })
      return NextResponse.json(
        { error: `You don't have permission to confirm tickets. Your role is: ${userProfile?.role || "unknown"}` },
        { status: 403 }
      )
    }

    console.log("[v0] Confirming all pending tickets for user:", userId, "role:", userProfile?.role)

    // Get tickets awaiting confirmation (include assigned_to for targeted notifications)
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("service_tickets")
      .select("id, status, assigned_to")
      .eq("status", "awaiting_confirmation")

    console.log("[v0] Ticket fetch result:", { ticketsError: ticketsError?.message, count: tickets?.length })

    if (ticketsError) {
      console.error("[v0] Error fetching tickets:", ticketsError)
      return NextResponse.json({ error: "Failed to fetch tickets: " + ticketsError.message }, { status: 500 })
    }

    // Confirm all awaiting tickets
    const confirmedCount = tickets?.length || 0
    console.log("[v0] Found", confirmedCount, "tickets to confirm")

    if (confirmedCount > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("service_tickets")
        .update({ 
          status: "resolved", 
          updated_at: new Date().toISOString()
        })
        .eq("status", "awaiting_confirmation")

      if (updateError) {
        console.error("[v0] Error confirming tickets:", updateError)
        return NextResponse.json({ error: "Failed to confirm tickets: " + updateError.message }, { status: 500 })
      }

      // Notify only the staff assigned to the tickets that were just confirmed
      const uniqueStaffIds = [...new Set(
        (tickets || []).map((t: any) => t.assigned_to).filter(Boolean)
      )]
      
      console.log("[v0] Notifying", uniqueStaffIds.length, "staff members")
      
      for (const staffId of uniqueStaffIds) {
        await supabaseAdmin.from("notifications").insert({
          user_id: staffId,
          type: "task_confirmed",
          title: "Task Confirmed",
          message: `Your completed task has been confirmed by ${userName || "management"}.`,
          priority: "normal",
          read: false,
          created_at: new Date().toISOString(),
        })
      }
    }

    console.log("[v0] Successfully confirmed", confirmedCount, "tickets")

    return NextResponse.json({
      success: true,
      count: confirmedCount,
      confirmedCount,
      message: `${confirmedCount} pending confirmation(s) have been approved by ${userProfile?.role === "admin" ? "Admin" : "Management"}.`,
    })
  } catch (err) {
    console.error("[v0] confirm-all error:", err)
    return NextResponse.json({ error: "Internal server error: " + String(err) }, { status: 500 })
  }
}
