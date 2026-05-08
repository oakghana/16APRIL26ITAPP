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
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    // Fetch user profile to check role
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()

    // Only admin and IT head can bulk confirm
    if (userProfile?.role !== "admin" && userProfile?.role !== "it_head") {
      return NextResponse.json(
        { error: "Only admin and IT heads can perform bulk confirmation" },
        { status: 403 }
      )
    }

    // Get tickets awaiting confirmation (include assigned_to for targeted notifications)
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("service_tickets")
      .select("id, status, assigned_to")
      .eq("status", "awaiting_confirmation")

    if (ticketsError) {
      console.error("[v0] Error fetching tickets:", ticketsError)
      return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 })
    }

    // Confirm all awaiting tickets
    const confirmedCount = tickets?.length || 0
    if (confirmedCount > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("service_tickets")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("status", "awaiting_confirmation")

      if (updateError) {
        console.error("[v0] Error confirming tickets:", updateError)
        return NextResponse.json({ error: "Failed to confirm tickets" }, { status: 500 })
      }

      // Notify only the staff assigned to the tickets that were just confirmed
      // (use the pre-update snapshot to avoid catching all historically-completed tickets)
      const uniqueStaffIds = [...new Set(
        (tickets || []).map((t: any) => t.assigned_to).filter(Boolean)
      )]
      for (const staffId of uniqueStaffIds) {
        await supabaseAdmin.from("notifications").insert({
          user_id: staffId,
          type: "task_confirmed",
          title: "Task Confirmed",
          message: "Your completed task has been confirmed by management.",
          priority: "normal",
          read: false,
          created_at: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({
      success: true,
      confirmedCount,
      message: `${confirmedCount} pending confirmations have been approved by ${userProfile?.role === "admin" ? "Admin" : "IT Head"}.`,
    })
  } catch (err) {
    console.error("[v0] confirm-all error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
