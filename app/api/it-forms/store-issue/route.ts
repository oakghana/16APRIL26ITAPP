import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

function isUuidLike(value?: string | null) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isHeadOfficeLocation(location: string | null | undefined): boolean {
  if (!location) return false
  const n = location.toLowerCase().replace(/[\s_-]+/g, "_").trim()
  return n === "head_office" || n === "head_office_accra" || n === "headoffice" ||
         n === "accra" || n.startsWith("head_office") || n === "ho"
}

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
    if (!data || data.length === 0) return candidate
  }
  return `${generateFiveCharAlphaNumeric().slice(0, 3)}${Date.now().toString().slice(-2)}`
}

export async function GET(request: NextRequest) {
  // Returns available central store (Head Office) stock for dispatch selection
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location") || "Head Office"

    const { data: items, error } = await supabaseAdmin
      .from("store_items")
      .select("id, name, category, quantity, unit, location, sku")
      .ilike("location", location.replace(/[_-]+/g, " ").trim())
      .gt("quantity", 0)
      .order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items: items || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { requisitionId, issuedBy, notes, supplierName, userRole, userLocation, dispatchItems } = await request.json()
    // dispatchItems: Array<{ id?: string; name: string; dispatchQty: number; unit?: string; category?: string }>

    if (!requisitionId || !issuedBy || !notes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const isStoreHead = userRole === "it_store_head"
    const isRegionalITHead = userRole === "regional_it_head"
    const isAdmin = userRole === "admin"

    if (!isStoreHead && !isRegionalITHead && !isAdmin) {
      return NextResponse.json({ error: "Only IT Store Head or Regional IT Head can issue items" }, { status: 403 })
    }

    if (isStoreHead && !supplierName) {
      return NextResponse.json({ error: "Supplier name is required for Store Head issuance" }, { status: 400 })
    }

    const { data: requisition } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select("*")
      .eq("id", requisitionId)
      .single()

    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 })
    }

    // Validate prerequisite: must be approved by IT Head first (status = pending_store)
    if (requisition.status !== "pending_store" && requisition.status !== "pending_regional_store") {
      return NextResponse.json({ error: "Requisition must be approved by IT Head before issuance" }, { status: 409 })
    }
    
    if (requisition.status === "issued") {
      return NextResponse.json({ error: "Requisition already issued" }, { status: 409 })
    }

    // Regional IT head can only process items dispatched to their region
    if (isRegionalITHead && requisition.status !== "pending_regional_store") {
      return NextResponse.json({ error: "This item has not been dispatched to regional stock yet" }, { status: 403 })
    }

    // Store head or admin processes pending_store items
    if ((isStoreHead || isAdmin) && requisition.status !== "pending_store") {
      return NextResponse.json({ error: "Requisition must be in pending_store status" }, { status: 409 })
    }

    // Determine requester location
    let requesterLocation = String(requisition.requester_location || requisition.location || "")
    if (!requesterLocation && isUuidLike(requisition.requested_by_id)) {
      const { data: rp } = await supabaseAdmin
        .from("profiles").select("location").eq("id", requisition.requested_by_id).single()
      requesterLocation = rp?.location || ""
    }
    if (!requesterLocation && requisition.requested_by) {
      const { data: rps } = await supabaseAdmin
        .from("profiles").select("location").ilike("full_name", requisition.requested_by).limit(1)
      requesterLocation = rps?.[0]?.location || ""
    }

    const isHeadOfficeRequester = isHeadOfficeLocation(requesterLocation)
    const generatedItemSn = requisition.item_sn || (await generateUniqueItemSn())
    const now = new Date().toISOString()

    // ── STORE HEAD: Head Office requester → issue directly ─────────────────
    // ── STORE HEAD: Regional requester   → dispatch to regional stock ───────
    // ── REGIONAL IT HEAD: always assigns from their local stock ─────────────

    if ((isStoreHead || isAdmin) && !isHeadOfficeRequester) {
      // DISPATCH TO REGIONAL STOCK
      const updateData: any = {
        status: "pending_regional_store",
        updated_at: now,
        // Record that store head dispatched it
        issued_by: issuedBy,
        issuance_notes: notes,
        item_sn: generatedItemSn,
      }
      if (supplierName) updateData.supplier_name = supplierName

      const approvalChain = Array.isArray(requisition.approval_timeline)
        ? [...requisition.approval_timeline]
        : Array.isArray(requisition.approval_chain) ? [...requisition.approval_chain] : []
      approvalChain.push({
        approver: issuedBy,
        role: "store_head",
        action: "dispatched_to_region",
        notes: `Dispatched to regional stock at ${requesterLocation}. ${notes}`,
        timestamp: now,
      })
      updateData.approval_timeline = approvalChain

      let dispatchError: any = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await supabaseAdmin
          .from("it_equipment_requisitions")
          .update(updateData)
          .eq("id", requisitionId)
          .select()
          .single()
        dispatchError = result.error
        if (!dispatchError) break
        const msg = String(dispatchError.message || "")
        const missing = msg.match(/Could not find the '([^']+)' column/i)?.[1]
        if (missing) { delete updateData[missing]; continue }
        break
      }
      if (dispatchError) {
        return NextResponse.json({ error: dispatchError.message || "Failed to dispatch" }, { status: 500 })
      }

      // Deduct from central store + upsert into regional store_items
      const itemsToDispatch: Array<{ id?: string; name: string; dispatchQty: number; unit?: string; category?: string }> =
        Array.isArray(dispatchItems) && dispatchItems.length > 0
          ? dispatchItems
          : [{ name: requisition.items_required || requisition.item_description || "IT Equipment",
               dispatchQty: Number(requisition.quantity_required || requisition.quantity || 1), unit: "unit", category: "IT Equipment" }]

      const regionalLocation = requesterLocation.replace(/[_-]+/g, " ").trim()

      for (const dispItem of itemsToDispatch) {
        const qty = Number(dispItem.dispatchQty) || 1

        // Deduct from central (Head Office) store
        if (dispItem.id) {
          const { data: centralItem } = await supabaseAdmin
            .from("store_items").select("id, quantity").eq("id", dispItem.id).maybeSingle()
          if (centralItem) {
            const newQty = Math.max(0, centralItem.quantity - qty)
            await supabaseAdmin.from("store_items")
              .update({ quantity: newQty, updated_at: now })
              .eq("id", centralItem.id)
              .then(() => {}).catch((e: any) => console.error("[v0] Central deduct error:", e?.message))
          }
        } else {
          // Deduct by name match at Head Office
          const { data: centralItem } = await supabaseAdmin
            .from("store_items").select("id, quantity")
            .ilike("name", dispItem.name)
            .or("location.ilike.Head Office,location.ilike.head_office,location.ilike.HQ")
            .maybeSingle()
          if (centralItem) {
            const newQty = Math.max(0, centralItem.quantity - qty)
            await supabaseAdmin.from("store_items")
              .update({ quantity: newQty, updated_at: now })
              .eq("id", centralItem.id)
              .then(() => {}).catch((e: any) => console.error("[v0] Central deduct by name error:", e?.message))
          }
        }

        // Add to regional store_items
        if (regionalLocation) {
          const { data: existingRegional } = await supabaseAdmin
            .from("store_items").select("id, quantity")
            .ilike("name", dispItem.name)
            .ilike("location", regionalLocation)
            .maybeSingle()
          if (existingRegional) {
            await supabaseAdmin.from("store_items")
              .update({ quantity: existingRegional.quantity + qty, updated_at: now })
              .eq("id", existingRegional.id)
              .then(() => {}).catch((e: any) => console.error("[v0] Regional add error:", e?.message))
          } else {
            await supabaseAdmin.from("store_items").insert({
              name: dispItem.name,
              category: dispItem.category || "IT Equipment",
              location: regionalLocation,
              quantity: qty,
              unit: dispItem.unit || "unit",
              requisition_sourced: true,
              notes: `Dispatched from HQ for requisition ${requisition.requisition_number}`,
              created_at: now, updated_at: now,
            }).then(() => {}).catch((e: any) => console.error("[v0] Regional insert error:", e?.message))
          }
        }
      }

      // Notify regional IT heads at that location
      const { data: regionalHeads } = await supabaseAdmin
        .from("profiles").select("id").eq("role", "regional_it_head").eq("is_active", true)
      if (regionalHeads && regionalHeads.length > 0) {
        await supabaseAdmin.from("notifications").insert(
          regionalHeads.map((rh: any) => ({
            user_id: rh.id,
            title: "IT Equipment Dispatched to Your Region",
            message: `Requisition ${requisition.requisition_number} has been dispatched by the IT Store to ${requesterLocation} stock. Please assign to the requesting staff.`,
            type: "info", category: "approval",
            reference_type: "it_equipment_requisition", reference_id: requisitionId, is_read: false,
          }))
        ).then(() => {}).catch((e: any) => console.error("[v0] Regional notify error:", e?.message))
      }

      return NextResponse.json({ success: true, dispatched: true, requesterLocation })
    }

    // ── DIRECT ISSUE (Head Office requester OR Regional IT Head assigning from local stock) ──
    const updateData: any = {
      store_head_approved: true,
      issued_by: issuedBy,
      issued_at: now,
      issuance_notes: notes,
      item_sn: generatedItemSn,
      status: "issued",
      updated_at: now,
    }
    if (supplierName) updateData.supplier_name = supplierName

    const approvalChain = Array.isArray(requisition.approval_timeline)
      ? [...requisition.approval_timeline]
      : Array.isArray(requisition.approval_chain) ? [...requisition.approval_chain] : []
    approvalChain.push({
      approver: issuedBy,
      role: isRegionalITHead ? "regional_it_head" : "store_head",
      action: "issued",
      notes: `${notes}${supplierName ? ` | Supplier: ${supplierName}` : ""} | Item S/N: ${generatedItemSn}`,
      timestamp: now,
    })
    updateData.approval_timeline = approvalChain

    let updateError: any = null
    let updated: any = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await supabaseAdmin
        .from("it_equipment_requisitions")
        .update(updateData).eq("id", requisitionId).select().single()
      updated = result.data
      updateError = result.error
      if (!updateError) break
      const msg = String(updateError.message || "")
      const missing = msg.match(/Could not find the '([^']+)' column/i)?.[1]
      if (missing) { delete updateData[missing]; continue }
      break
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Failed to issue" }, { status: 500 })
    }

    // Notify requester
    const notifyId = isUuidLike(requisition.requested_by_id) ? requisition.requested_by_id
      : isUuidLike(requisition.created_by_id) ? requisition.created_by_id : null
    if (notifyId) {
      await supabaseAdmin.from("notifications").insert({
        user_id: notifyId,
        title: "Your IT Equipment has been Issued",
        message: `Your requisition ${requisition.requisition_number} has been fulfilled. Item S/N: ${generatedItemSn}.`,
        type: "success", category: "approval",
        reference_type: "it_equipment_requisition", reference_id: requisitionId, is_read: false,
      }).then(() => {}).catch((e: any) => console.error("[v0] Notify requester error:", e?.message))
    }

    return NextResponse.json({ success: true, requisition: updated })
  } catch (error: any) {
    console.error("[v0] store-issue error:", error?.message || error)
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 })
  }
}
