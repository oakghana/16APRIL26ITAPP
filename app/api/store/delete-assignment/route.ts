import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

const ALLOWED_ROLES = ["admin", "it_store_head"]

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { assignmentId, deletedBy, userRole, reason } = body

    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: "You do not have permission to revoke assignments" },
        { status: 403 }
      )
    }

    if (!assignmentId) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })
    }

    if (!reason?.trim()) {
      return NextResponse.json({ error: "A reason for revoking is required" }, { status: 400 })
    }

    // Fetch existing assignment for audit trail
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("stock_assignments")
      .select("*")
      .eq("id", assignmentId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Delete the assignment
    const { error: deleteError } = await supabaseAdmin
      .from("stock_assignments")
      .delete()
      .eq("id", assignmentId)

    if (deleteError) {
      console.error("[delete-assignment] Error deleting assignment:", deleteError)
      return NextResponse.json({ error: "Failed to revoke assignment" }, { status: 500 })
    }

    // Log the deletion
    try {
      await supabaseAdmin.from("activity_logs").insert({
        action: "revoke_assignment",
        entity_type: "stock_assignment",
        entity_id: assignmentId,
        performed_by: deletedBy,
        details: `Revoked assignment of ${existing.item_name} (qty: ${existing.quantity}) from ${existing.assigned_to}. Reason: ${reason}`,
        timestamp: new Date().toISOString(),
      })
    } catch (_) {
      // Non-fatal: continue even if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: "Assignment revoked successfully",
      assignmentId,
    })
  } catch (error: any) {
    console.error("[delete-assignment] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
