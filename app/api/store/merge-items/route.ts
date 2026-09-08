import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sourceItemId, targetItemId, mergeReason, userRole, userLocation, userId } = body

    if (!sourceItemId || !targetItemId || !userRole || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (sourceItemId === targetItemId) {
      return NextResponse.json({ error: "Cannot merge an item with itself" }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get both items
    const { data: sourceItem } = await supabase.from("store_items").select("*").eq("id", sourceItemId).single()
    const { data: targetItem } = await supabase.from("store_items").select("*").eq("id", targetItemId).single()

    if (!sourceItem || !targetItem) {
      return NextResponse.json({ error: "One or both items not found" }, { status: 404 })
    }

    // Check authorization
    const canManage =
      userRole === "admin" ||
      userRole === "it_store_head" ||
      (userRole === "it_head" && userLocation === "Head Office")

    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized to merge store items" }, { status: 403 })
    }

    // Merge quantities
    const mergedQuantity = (sourceItem.quantity || 0) + (targetItem.quantity || 0)

    // Update target item with merged quantity
    const { error: updateError } = await supabase
      .from("store_items")
      .update({
        quantity: mergedQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetItemId)

    if (updateError) {
      console.error("[v0] Error merging items:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Re-parent every record that points at the source item, otherwise the
    // source row cannot be removed (stock_transfer_requests.item_id is NOT NULL)
    // and its history would be orphaned.
    const relatedTables = [
      "stock_transactions",
      "stock_assignments",
      "stock_transfer_requests",
      "stock_audit_log",
      "allocation_items",
    ] as const

    const reassigned: Record<string, number> = {}

    for (const table of relatedTables) {
      const { data: moved, error: moveError } = await supabase
        .from(table)
        .update({ item_id: targetItemId })
        .eq("item_id", sourceItemId)
        .select("id")

      if (moveError) {
        // A missing table in this deployment must not abort the merge.
        if (moveError.code === "42P01") continue
        console.error(`[v0] Error re-parenting ${table} during merge:`, moveError)
        return NextResponse.json(
          { error: `Failed to move ${table.replace(/_/g, " ")} to the target item`, details: moveError.message },
          { status: 500 },
        )
      }

      reassigned[table] = moved?.length || 0
    }

    // Log merge action to audit trail
    await supabase.from("audit_logs").insert({
      user: userId,
      action: "STORE_ITEMS_MERGED",
      resource: `store_items/${sourceItemId}_${targetItemId}`,
      details: `Merged duplicate items: "${sourceItem.name}" (${sourceItem.quantity} units) merged into "${targetItem.name}". New total: ${mergedQuantity} units. Reason: ${mergeReason || "Duplicate consolidation"}`,
      severity: "medium",
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    })

    // Delete source item
    const { error: deleteError } = await supabase.from("store_items").delete().eq("id", sourceItemId)

    if (deleteError) {
      console.error("[v0] Error deleting source item:", deleteError)
      return NextResponse.json(
        { error: "Merge completed but failed to delete source item", details: deleteError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully merged "${sourceItem.name}" into "${targetItem.name}" (${mergedQuantity} units)`,
      mergedData: {
        targetItemId,
        sourceItemId,
        mergedQuantity,
        sourceQuantity: sourceItem.quantity,
        targetQuantity: targetItem.quantity,
        reassigned,
      },
    })
  } catch (error: any) {
    console.error("[v0] Error in merge-items route:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
