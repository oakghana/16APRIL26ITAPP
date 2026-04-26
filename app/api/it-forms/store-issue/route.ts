import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

function generateFiveCharAlphaNumeric() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let token = ""
  for (let i = 0; i < 5; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return token
}

async function generateUniqueItemSn() {
  for (let i = 0; i < 20; i++) {
    const candidate = generateFiveCharAlphaNumeric()
    const { data } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select("id")
      .eq("item_sn", candidate)
      .limit(1)

    if (!data || data.length === 0) {
      return candidate
    }
  }

  // Fallback with timestamp suffix to avoid hard failure on unlikely collision loops.
  return `${generateFiveCharAlphaNumeric().slice(0, 3)}${Date.now().toString().slice(-2)}`
}

export async function POST(request: NextRequest) {
  try {
    const { requisitionId, issuedBy, notes, supplierName, userRole, userLocation } = await request.json()

    if (!requisitionId || !issuedBy || !notes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const isRegionalITHead = userRole === "regional_it_head"
    const isStoreHead = userRole === "it_store_head"
    const isAdmin = userRole === "admin"

    if (!isStoreHead && !isRegionalITHead && !isAdmin) {
      return NextResponse.json({ error: "Only IT Store Head or Regional IT Head can issue items" }, { status: 403 })
    }

    // Store Head requires supplierName; regional IT head does not need it
    if (isStoreHead && !supplierName) {
      return NextResponse.json({ error: "Supplier name is required for Store Head issuance" }, { status: 400 })
    }

    const { data: requisition } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select()
      .eq("id", requisitionId)
      .single()

    if (!requisition) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Regional IT head can only process pending_regional_store items
    if (isRegionalITHead && requisition.status !== "pending_regional_store") {
      return NextResponse.json({ error: "Regional IT Head can only process regionally-assigned requisitions" }, { status: 403 })
    }

    // Store head can only process pending_store items (Head Office flow)
    if (isStoreHead && requisition.status !== "pending_store" && !(requisition.it_head_approved || requisition.admin_approved)) {
      return NextResponse.json({ error: "Requisition must be IT Head approved and in pending_store status" }, { status: 409 })
    }

    if (!(requisition.it_head_approved || requisition.admin_approved)) {
      return NextResponse.json({ error: "Requisition must be approved by IT Manager/IT Head before store issuance" }, { status: 409 })
    }

    if (requisition.store_head_approved) {
      return NextResponse.json({ error: "Requisition already issued" }, { status: 409 })
    }

    const generatedItemSn = requisition.item_sn || (await generateUniqueItemSn())

    const updateData: any = {
      store_head_approved: true,
      issued_by: issuedBy,
      issued_at: new Date().toISOString(),
      issuance_notes: notes,
      item_sn: generatedItemSn,
      status: "issued",
      updated_at: new Date().toISOString(),
    }
    if (supplierName) updateData.supplier_name = supplierName

    const approvalChain = requisition.approval_timeline || requisition.approval_chain || []
    approvalChain.push({
      approver: issuedBy,
      role: "store_head",
      action: "issued",
      notes: `${notes} | Supplier: ${supplierName} | Item S/N: ${generatedItemSn}`,
      timestamp: new Date().toISOString(),
    })
    updateData.approval_timeline = approvalChain

    const { data: updated } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .update(updateData)
      .eq("id", requisitionId)
      .select()
      .single()

    // For regional IT head: add the requisitioned item to regional store stock for tracking
    if (isRegionalITHead) {
      const itemName = requisition.items_required || requisition.item_description || "IT Equipment"
      const itemQty = Number(requisition.quantity_required || requisition.quantity || 1)
      const targetLocation = userLocation || requisition.requester_location || requisition.location || ""
      if (targetLocation) {
        // Try to find existing store item at this location
        const { data: existingItem } = await supabaseAdmin
          .from("store_items")
          .select("id, quantity")
          .ilike("name", itemName)
          .ilike("location", targetLocation.replace(/[_-]+/g, " ").trim())
          .maybeSingle()

        if (existingItem) {
          await supabaseAdmin
            .from("store_items")
            .update({ quantity: existingItem.quantity + itemQty, updated_at: new Date().toISOString() })
            .eq("id", existingItem.id)
            .catch(console.error)
        } else {
          await supabaseAdmin
            .from("store_items")
            .insert({
              name: itemName,
              category: "IT Equipment",
              location: targetLocation,
              quantity: itemQty,
              unit: "unit",
              requisition_sourced: true,
              notes: `Auto-created from requisition ${requisition.requisition_number}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .catch(console.error)
        }
      }
    }

    // Notify staff
    await supabaseAdmin.from("notifications").insert({
      recipient_id: requisition.requested_by,
      recipient_type: "staff",
      title: "Your IT Equipment has been Issued",
      message: `Your requisition ${requisition.requisition_number} has been fulfilled and is ready for collection.`,
      type: "it_form_update",
      related_id: requisitionId,
      related_type: "it_equipment_requisition",
      read: false,
    }).catch(err => console.error("[v0]:", err))

    return NextResponse.json({ success: true, requisition: updated })
  } catch (error) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
