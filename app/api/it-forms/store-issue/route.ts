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
    const { requisitionId, issuedBy, notes, supplierName, userRole } = await request.json()

    if (!requisitionId || !issuedBy || !notes || !supplierName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (userRole !== "it_store_head") {
      return NextResponse.json({ error: "Only IT Store Head can issue and complete supplier details" }, { status: 403 })
    }

    const { data: requisition } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select()
      .eq("id", requisitionId)
      .single()

    if (!requisition) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (!(requisition.it_head_approved || requisition.admin_approved)) {
      return NextResponse.json({ error: "Requisition must be approved by IT Manager/IT Head or Admin before store issuance" }, { status: 409 })
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
      supplier_name: supplierName,
      item_sn: generatedItemSn,
      status: "issued",
      updated_at: new Date().toISOString(),
    }

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
