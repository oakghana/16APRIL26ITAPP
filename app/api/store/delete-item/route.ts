import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { itemId, deletedBy, reason, userRole, userLocation } = body

    if (!itemId || !deletedBy || !reason || !userRole) {
      return NextResponse.json({ error: "Item ID, deleted by, reason, and user role are required" }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get item details before deletion for authorization check
    const { data: item, error: fetchError } = await supabase.from("store_items").select("*").eq("id", itemId).single()

    if (fetchError || !item) {
      console.error("[v0] Item not found:", fetchError)
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    // Admin and IT Head can delete all items, Regional IT Head can delete items in their location
    const canDelete =
      userRole === "admin" ||
      userRole === "it_head" ||
      (userRole === "regional_it_head" && userLocation === item.location)

    if (!canDelete) {
      console.error("[v0] Unauthorized stock deletion attempt by:", deletedBy, userRole, userLocation, "for item at:", item.location)
      return NextResponse.json(
        { error: "Unauthorized: You don't have permission to delete stock items at this location" },
        { status: 403 },
      )
    }

    // Check for related stock transfer requests
    const { data: transferRequests, error: transferError } = await supabase
      .from("stock_transfer_requests")
      .select("*")
      .eq("item_id", itemId)
      .in("status", ["pending", "approved"])

    if (transferError) {
      console.error("[v0] Error checking transfer requests:", transferError)
    }

    // Check for related stock assignments
    const { data: assignments, error: assignmentError } = await supabase
      .from("stock_assignments")
      .select("*")
      .eq("item_id", itemId)
      .neq("status", "returned")

    if (assignmentError) {
      console.error("[v0] Error checking assignments:", assignmentError)
    }

    const blockers: string[] = []

    if (transferRequests && transferRequests.length > 0) {
      blockers.push(`${transferRequests.length} active transfer request(s) that must be cancelled or rejected first.`)
    }

    if (assignments && assignments.length > 0) {
      blockers.push(`${assignments.length} active assignment(s) that must be returned first.`)
    }

    if (blockers.length > 0) {
      console.log(`[v0] Cannot delete item ${itemId}:`, blockers.join(" "))
      return NextResponse.json(
        {
          error: "Cannot delete this item",
          reason: `"${item.name}" still has ${blockers.join(" It also has ")}`,
          blockers,
          // Admins can bypass these blockers via /api/store/force-delete-item
          canForceDelete: userRole === "admin",
          activeRequests: (transferRequests || []).map((req) => ({
            id: req.id,
            requestNumber: req.request_number,
            quantity: req.requested_quantity,
            status: req.status,
            location: req.requesting_location,
          })),
        },
        { status: 409 },
      )
    }

    // If we get here, it's safe to delete
    await supabase.from("stock_audit_log").insert({
      item_id: itemId,
      action: "delete",
      updated_by: deletedBy,
      reason: reason,
      changes: { deleted_item: item },
    })

    // Log to main audit_logs table
    await supabase.from("audit_logs").insert({
      user: deletedBy,
      action: "STOCK_DELETED",
      resource: `store_items/${itemId}`,
      details: `Deleted stock item: ${item.name}. Reason: ${reason}`,
      severity: "high",
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    })

    // Delete the item
    const { error: deleteError } = await supabase.from("store_items").delete().eq("id", itemId)

    if (deleteError) {
      console.error("[v0] Error deleting stock item:", deleteError)

      // 23503 = foreign key violation: historical rows still reference this item
      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            error: "Cannot delete this item",
            reason: `"${item.name}" is still referenced by historical stock records.`,
            blockers: ["Linked historical stock records (transfers, transactions or assignments)."],
            canForceDelete: userRole === "admin",
          },
          { status: 409 },
        )
      }

      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Item deleted successfully" })
  } catch (error: any) {
    console.error("[v0] Error in delete-item route:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
