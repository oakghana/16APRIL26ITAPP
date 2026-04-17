import { type NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const body = await request.json()
    const { itemId, itemName, quantity, fromLocation, toLocation, transferredById, transferredByName, notes } = body

    // Insert transfer record
    const { data: transfer, error: transferError } = await supabase
      .from("stock_transfers")
      .insert({
        item_id: itemId,
        item_name: itemName,
        quantity: Number.parseInt(quantity),
        from_location: fromLocation,
        to_location: toLocation,
        transferred_by: transferredById,
        transferred_by_name: transferredByName,
        status: "completed",
        notes: notes || null,
        transfer_date: new Date().toISOString(),
        received_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (transferError) throw transferError

    return NextResponse.json({ success: true, transfer })
  } catch (error: any) {
    console.error("Transfer error:", error)
    return NextResponse.json({ error: error.message || "Failed to transfer item" }, { status: 500 })
  }
}
