import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

type DispatchItem = {
  id?: string
  name: string
  dispatchQty: number
  unit?: string
  category?: string
}

type PreparedIssuanceMeta = {
  mode: "direct" | "regional"
  requesterLocation: string
  supplierName?: string | null
  notes?: string
  dispatchItems?: DispatchItem[]
  preparedAt?: string
  preparedBy?: string
  preparedById?: string | null
}

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

function getTimelineEntries(record: any) {
  const raw = record?.approval_timeline ?? record?.approval_chain
  if (Array.isArray(raw)) return [...raw]
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function getLatestPreparedIssuance(record: any): PreparedIssuanceMeta | null {
  const timeline = getTimelineEntries(record)
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index]
    if (!entry || typeof entry !== "object") continue
    if (!["issue_prepared", "issue_updated", "dispatch_prepared", "dispatch_updated"].includes(String(entry.action || ""))) {
      continue
    }

    const meta = entry.meta && typeof entry.meta === "object" ? entry.meta : entry
    const mode = meta.mode === "regional" ? "regional" : "direct"
    return {
      mode,
      requesterLocation: String(meta.requesterLocation || meta.location || ""),
      supplierName: meta.supplierName || null,
      notes: meta.notes || entry.notes || "",
      dispatchItems: Array.isArray(meta.dispatchItems) ? meta.dispatchItems : [],
      preparedAt: meta.preparedAt || entry.timestamp,
      preparedBy: meta.preparedBy || entry.approver,
      preparedById: meta.preparedById || null,
    }
  }
  return null
}

function buildFallbackDispatchItems(requisition: any): DispatchItem[] {
  return [{
    name: requisition.items_required || requisition.item_description || "IT Equipment",
    dispatchQty: Number(requisition.quantity_required || requisition.quantity || 1),
    unit: "unit",
    category: "IT Equipment",
  }]
}

async function applyRegionalStockTransfer(
  requisition: any,
  requesterLocation: string,
  dispatchItems: DispatchItem[],
  now: string
) {
  const itemsToDispatch = Array.isArray(dispatchItems) && dispatchItems.length > 0
    ? dispatchItems
    : buildFallbackDispatchItems(requisition)

  const regionalLocation = requesterLocation.replace(/[_-]+/g, " ").trim()

  for (const dispItem of itemsToDispatch) {
    const qty = Number(dispItem.dispatchQty) || 1

    if (dispItem.id) {
      const { data: centralItem } = await supabaseAdmin
        .from("store_items").select("id, quantity").eq("id", dispItem.id).maybeSingle()
      if (centralItem) {
        const newQty = Math.max(0, Number(centralItem.quantity || 0) - qty)
        await supabaseAdmin.from("store_items")
          .update({ quantity: newQty, updated_at: now })
          .eq("id", centralItem.id)
          .then(() => {}).catch((error: any) => console.error("[v0] Central deduct error:", error?.message))
      }
    } else {
      const { data: centralItem } = await supabaseAdmin
        .from("store_items").select("id, quantity")
        .ilike("name", dispItem.name)
        .or("location.ilike.Head Office,location.ilike.head_office,location.ilike.HQ")
        .maybeSingle()
      if (centralItem) {
        const newQty = Math.max(0, Number(centralItem.quantity || 0) - qty)
        await supabaseAdmin.from("store_items")
          .update({ quantity: newQty, updated_at: now })
          .eq("id", centralItem.id)
          .then(() => {}).catch((error: any) => console.error("[v0] Central deduct by name error:", error?.message))
      }
    }

    if (regionalLocation) {
      const { data: existingRegional } = await supabaseAdmin
        .from("store_items").select("id, quantity")
        .ilike("name", dispItem.name)
        .ilike("location", regionalLocation)
        .maybeSingle()
      if (existingRegional) {
        await supabaseAdmin.from("store_items")
          .update({ quantity: Number(existingRegional.quantity || 0) + qty, updated_at: now })
          .eq("id", existingRegional.id)
          .then(() => {}).catch((error: any) => console.error("[v0] Regional add error:", error?.message))
      } else {
        await supabaseAdmin.from("store_items").insert({
          name: dispItem.name,
          category: dispItem.category || "IT Equipment",
          location: regionalLocation,
          quantity: qty,
          unit: dispItem.unit || "unit",
          requisition_sourced: true,
          notes: `Dispatched from HQ for requisition ${requisition.requisition_number || requisition.reg_no || requisition.id}`,
          created_at: now,
          updated_at: now,
        }).then(() => {}).catch((error: any) => console.error("[v0] Regional insert error:", error?.message))
      }
    }
  }
}

function requesterMatches(record: any, actorId?: string | null, actorName?: string | null, actorEmail?: string | null) {
  const normalizedActorName = String(actorName || "").toLowerCase().trim()
  const normalizedActorEmail = String(actorEmail || "").toLowerCase().trim()

  return Boolean(
    (isUuidLike(actorId) && [record.requested_by_id, record.created_by_id].includes(actorId)) ||
    normalizedActorName && [record.requested_by, record.created_by_name, record.staff_name].some((value: any) => String(value || "").toLowerCase().trim() === normalizedActorName) ||
    normalizedActorEmail && [record.requested_by_email, record.created_by_email, record.staff_email].some((value: any) => String(value || "").toLowerCase().trim() === normalizedActorEmail)
  )
}

async function updateRequisitionRecord(requisitionId: string, updateData: Record<string, any>, uuidFieldNames: string[] = []) {
  let updated: any = null
  let updateError: any = null

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await supabaseAdmin
      .from("it_equipment_requisitions")
      .update(updateData)
      .eq("id", requisitionId)
      .select()
      .single()

    updated = result.data
    updateError = result.error
    if (!updateError) break

    const message = String(updateError.message || "")
    const missingColumn = message.match(/Could not find the '([^']+)' column/i)?.[1]
    if (missingColumn) {
      delete updateData[missingColumn]
      continue
    }

    if (updateError.code === "22P02" && /invalid input syntax for type uuid/i.test(message)) {
      let changed = false
      for (const field of uuidFieldNames) {
        if (Object.prototype.hasOwnProperty.call(updateData, field)) {
          updateData[field] = null
          changed = true
        }
      }
      if (changed) continue
    }

    break
  }

  return { updated, updateError }
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
    const {
      requisitionId,
      issuedBy,
      issuedById,
      notes,
      supplierName,
      userRole,
      userLocation,
      dispatchItems,
      assignedRegionalHeadId,
      assignedRegionalHeadName,
      dispatchToLocation,
    } = await request.json()
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

    const normalizedReqStatus = String(requisition.status || "").toLowerCase().trim()
    const isAwaitingUserConfirmation = normalizedReqStatus === "awaiting_user_confirmation"
    const isAwaitingRegionalConfirmation = normalizedReqStatus === "awaiting_regional_confirmation"
    const hasApprovalMarker = Boolean(
      requisition.it_head_approved === true ||
      requisition.admin_approved === true ||
      requisition.it_manager_approved === true ||
      requisition.it_head_approved_by ||
      requisition.it_head_approved_by_name ||
      requisition.admin_approved_by ||
      requisition.admin_approved_by_name ||
      requisition.it_manager_approved_by ||
      requisition.it_manager_approved_by_name ||
      requisition.manager_approved_by ||
      requisition.manager_approved_by_name ||
      requisition.it_head_approved_at ||
      requisition.admin_approved_at ||
      requisition.it_manager_approved_at ||
      requisition.manager_approved_at
    )
    const isLegacyApprovedAwaitingStore =
      !["issued", "rejected", "rejected_it_head", "rejected_admin", "cancelled", "completed"].includes(normalizedReqStatus) &&
      requisition.store_head_approved !== true &&
      hasApprovalMarker

    const isPendingStoreStage =
      normalizedReqStatus === "pending_store" ||
      normalizedReqStatus === "ready_for_issuance" ||
      isLegacyApprovedAwaitingStore
    const isPendingRegionalStage = normalizedReqStatus === "pending_regional_store"

    // Validate prerequisite: must be approved by IT manager/head/admin and ready for store processing.
    if (!isPendingStoreStage && !isPendingRegionalStage && !isAwaitingUserConfirmation && !isAwaitingRegionalConfirmation) {
      return NextResponse.json({ error: "Requisition is not in a store-processing stage" }, { status: 409 })
    }
    
    if (requisition.status === "issued") {
      return NextResponse.json({ error: "Requisition already issued" }, { status: 409 })
    }

    // Regional IT head can only process items dispatched to their region
    if (isRegionalITHead && !isPendingRegionalStage) {
      return NextResponse.json({ error: "This item has not been dispatched to regional stock yet" }, { status: 403 })
    }

    // Store head or admin processes pending_store items
    if ((isStoreHead || isAdmin) && !isPendingStoreStage && !isAwaitingUserConfirmation && !isAwaitingRegionalConfirmation) {
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
    const now = new Date().toISOString()
    const issuedByUuid = isUuidLike(issuedById) ? issuedById : null
    const existingTimeline = getTimelineEntries(requisition)

    // ── STORE HEAD: Head Office requester → issue directly ─────────────────
    // ── STORE HEAD: Regional requester   → dispatch to regional stock ───────
    // ── REGIONAL IT HEAD: always assigns from their local stock ─────────────

    if ((isStoreHead || isAdmin) && !isHeadOfficeRequester) {
      // Prepare dispatch and wait for regional IT head confirmation before stock moves.
      const preparedDispatchItems = Array.isArray(dispatchItems) && dispatchItems.length > 0
        ? dispatchItems
        : buildFallbackDispatchItems(requisition)

      let regionalHeadLocation = ""
      if (isUuidLike(assignedRegionalHeadId)) {
        const { data: assignedRegionalHead } = await supabaseAdmin
          .from("profiles")
          .select("location")
          .eq("id", assignedRegionalHeadId)
          .maybeSingle()
        regionalHeadLocation = String(assignedRegionalHead?.location || "")
      }

      const regionalTargetLocation = String(
        dispatchToLocation ||
        regionalHeadLocation ||
        requesterLocation ||
        requisition.requester_location ||
        requisition.location ||
        ""
      ).trim()

      const updateData: any = {
        status: "awaiting_regional_confirmation",
        updated_at: now,
        issued_by: issuedByUuid,
        issuance_notes: notes,
        supplier_name: supplierName || requisition.supplier_name || null,
        store_head_approved_at: now,
        store_head_approved_by: issuedByUuid,
        store_head_approved_by_name: issuedBy,
        store_head_approval_comments: notes,
      }
      updateData.issued_by_name = issuedBy
      if (assignedRegionalHeadName) updateData.assigned_to_name = assignedRegionalHeadName
      if (isUuidLike(assignedRegionalHeadId)) updateData.assigned_to_id = assignedRegionalHeadId
      if (regionalTargetLocation) updateData.requester_location = regionalTargetLocation

      existingTimeline.push({
        approver: issuedBy,
        role: "store_head",
        action: isAwaitingRegionalConfirmation ? "dispatch_updated" : "dispatch_prepared",
        notes: `Dispatch ${isAwaitingRegionalConfirmation ? "updated" : "prepared"} for ${regionalTargetLocation || requesterLocation || "regional location"}. ${notes}`,
        timestamp: now,
        meta: {
          mode: "regional",
          requesterLocation: regionalTargetLocation || requesterLocation,
          dispatchToLocation: regionalTargetLocation || requesterLocation,
          assignedRegionalHeadId: isUuidLike(assignedRegionalHeadId) ? assignedRegionalHeadId : null,
          assignedRegionalHeadName: assignedRegionalHeadName || null,
          supplierName: supplierName || requisition.supplier_name || null,
          notes,
          dispatchItems: preparedDispatchItems,
          preparedAt: now,
          preparedBy: issuedBy,
          preparedById: issuedByUuid,
        },
      })
      updateData.approval_timeline = existingTimeline

      const { updateError } = await updateRequisitionRecord(requisitionId, updateData, ["issued_by", "store_head_approved_by"])
      if (updateError) {
        return NextResponse.json({ error: updateError.message || "Failed to prepare dispatch" }, { status: 500 })
      }

      // Notify regional IT heads at that location
      const { data: regionalHeads } = await supabaseAdmin
        .from("profiles").select("id, location").eq("role", "regional_it_head").eq("is_active", true)
      if (regionalHeads && regionalHeads.length > 0) {
        await supabaseAdmin.from("notifications").insert(
          regionalHeads
            .filter((rh: any) => {
              if (isUuidLike(assignedRegionalHeadId)) {
                return rh.id === assignedRegionalHeadId
              }
              if (!regionalTargetLocation) return !rh.location
              return String(rh.location).toLowerCase().trim() === String(regionalTargetLocation).toLowerCase().trim()
            })
            .map((rh: any) => ({
            user_id: rh.id,
            title: "IT Equipment Awaiting Your Receipt Confirmation",
            message: `Requisition ${requisition.requisition_number || requisition.reg_no || requisition.id} is prepared for dispatch to ${regionalTargetLocation || requesterLocation || "your region"}. Please confirm receipt before stock is posted to your regional store.`,
            type: "info", category: "approval",
            reference_type: "it_equipment_requisition", reference_id: requisitionId, is_read: false,
          }))
        ).then(() => {}).catch((e: any) => console.error("[v0] Regional notify error:", e?.message))
      }

      return NextResponse.json({ success: true, awaitingConfirmation: true, confirmationTarget: "regional_it_head", requesterLocation: regionalTargetLocation || requesterLocation })
    }

    // For Head Office requests: skip confirmation workflow and issue directly
    if ((isStoreHead || isAdmin) && isHeadOfficeRequester) {
      // Head Office requester = direct issuance without confirmation needed
      const generatedItemSn = requisition.item_sn || (await generateUniqueItemSn())
      const updateData: any = {
        issued_by: issuedByUuid,
        issued_at: now,
        issuance_notes: notes,
        item_sn: generatedItemSn,
        status: "issued",
        updated_at: now,
      }
      updateData.issued_by_name = issuedBy
      if (supplierName) updateData.supplier_name = supplierName

      existingTimeline.push({
        approver: issuedBy,
        role: "store_head",
        action: "issued",
        notes: `${notes}${supplierName ? ` | Supplier: ${supplierName}` : ""} | Item S/N: ${generatedItemSn} | Head Office request - no confirmation required`,
        timestamp: now,
      })
      updateData.approval_timeline = existingTimeline

      const { updated, updateError } = await updateRequisitionRecord(requisitionId, updateData, ["issued_by"])

      if (updateError) {
        return NextResponse.json({ error: updateError.message || "Failed to issue" }, { status: 500 })
      }

      // Notify requester that items have been issued
      const notifyId = isUuidLike(requisition.requested_by_id) ? requisition.requested_by_id
        : isUuidLike(requisition.created_by_id) ? requisition.created_by_id : null
      if (notifyId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: notifyId,
          title: "Your IT Equipment has been Issued",
          message: `Your requisition ${requisition.requisition_number} has been fulfilled. Item S/N: ${generatedItemSn}.`,
          type: "success",
          category: "approval",
          reference_type: "it_equipment_requisition",
          reference_id: requisitionId,
          is_read: false,
        }).then(() => {}).catch((error: any) => console.error("[v0] Notify requester error:", error?.message))
      }

      return NextResponse.json({ success: true, requisition: updated })
    }

    // ── REGIONAL IT HEAD: assign from local stock to staff after receipt confirmation ──
    const generatedItemSn = requisition.item_sn || (await generateUniqueItemSn())
    const updateData: any = {
      issued_by: issuedByUuid,
      issued_at: now,
      issuance_notes: notes,
      item_sn: generatedItemSn,
      status: "issued",
      updated_at: now,
    }
    updateData.issued_by_name = issuedBy
    if (supplierName) updateData.supplier_name = supplierName

    existingTimeline.push({
      approver: issuedBy,
      role: isRegionalITHead ? "regional_it_head" : "store_head",
      action: "issued",
      notes: `${notes}${supplierName ? ` | Supplier: ${supplierName}` : ""} | Item S/N: ${generatedItemSn}`,
      timestamp: now,
    })
    updateData.approval_timeline = existingTimeline

    const { updated, updateError } = await updateRequisitionRecord(requisitionId, updateData, ["issued_by"])

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

export async function PATCH(request: NextRequest) {
  try {
    const { requisitionId, action, actorId, actorName, actorEmail, actorRole, actorLocation, confirmation, notes } = await request.json()

    if (!requisitionId || !action) {
      return NextResponse.json({ error: "Missing requisitionId or action" }, { status: 400 })
    }

    const { data: requisition } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select("*")
      .eq("id", requisitionId)
      .single()

    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const timeline = getTimelineEntries(requisition)
    const prepared = getLatestPreparedIssuance(requisition)
    const normalizedStatus = String(requisition.status || "").toLowerCase().trim()
    const normalizedRole = String(actorRole || "").toLowerCase().trim()

    if (action === "regional_confirm_receipt") {
      if (!prepared || prepared.mode !== "regional") {
        return NextResponse.json({ error: "No prepared regional dispatch found" }, { status: 409 })
      }
      if (normalizedStatus !== "awaiting_regional_confirmation") {
        return NextResponse.json({ error: "Requisition is not awaiting regional confirmation" }, { status: 409 })
      }
      if (![
        "regional_it_head",
        "admin",
      ].includes(normalizedRole)) {
        return NextResponse.json({ error: "Only Regional IT Head can confirm receipt" }, { status: 403 })
      }

      if (confirmation === "rejected") {
        timeline.push({
          approver: actorName || "Regional IT Head",
          role: "regional_it_head",
          action: "regional_receipt_rejected",
          notes: notes || "Receipt not confirmed",
          timestamp: now,
        })
        const { updated, updateError } = await updateRequisitionRecord(requisitionId, {
          status: "pending_store",
          updated_at: now,
          approval_timeline: timeline,
        })
        if (updateError) {
          return NextResponse.json({ error: updateError.message || "Failed to reopen dispatch" }, { status: 500 })
        }
        return NextResponse.json({ success: true, requisition: updated })
      }

      await applyRegionalStockTransfer(
        requisition,
        prepared.requesterLocation,
        prepared.dispatchItems || [],
        now,
      )

      timeline.push({
        approver: actorName || "Regional IT Head",
        role: "regional_it_head",
        action: "regional_receipt_confirmed",
        notes: notes || `Confirmed receipt for ${prepared.requesterLocation}`,
        timestamp: now,
      })

      const { updated, updateError } = await updateRequisitionRecord(requisitionId, {
        status: "pending_regional_store",
        updated_at: now,
        approval_timeline: timeline,
      })
      if (updateError) {
        return NextResponse.json({ error: updateError.message || "Failed to confirm regional receipt" }, { status: 500 })
      }
      return NextResponse.json({ success: true, requisition: updated })
    }

    if (action === "user_confirm_receipt") {
      if (!prepared || prepared.mode !== "direct") {
        return NextResponse.json({ error: "No prepared direct issuance found" }, { status: 409 })
      }
      if (normalizedStatus !== "awaiting_user_confirmation") {
        return NextResponse.json({ error: "Requisition is not awaiting requester confirmation" }, { status: 409 })
      }

      const isRequester = requesterMatches(requisition, actorId, actorName, actorEmail)
      if (!isRequester && normalizedRole !== "admin") {
        return NextResponse.json({ error: "Only requester can confirm receipt" }, { status: 403 })
      }

      if (confirmation === "rejected") {
        timeline.push({
          approver: actorName || requisition.requested_by || "Requester",
          role: "requester",
          action: "receipt_rejected",
          notes: notes || "Receipt not confirmed",
          timestamp: now,
        })
        const { updated, updateError } = await updateRequisitionRecord(requisitionId, {
          status: "pending_store",
          updated_at: now,
          approval_timeline: timeline,
        })
        if (updateError) {
          return NextResponse.json({ error: updateError.message || "Failed to reopen issuance" }, { status: 500 })
        }
        return NextResponse.json({ success: true, requisition: updated })
      }

      const generatedItemSn = requisition.item_sn || (await generateUniqueItemSn())
      timeline.push({
        approver: actorName || requisition.requested_by || "Requester",
        role: "requester",
        action: "receipt_confirmed",
        notes: notes || "Item received and confirmed",
        timestamp: now,
      })

      const { updated, updateError } = await updateRequisitionRecord(requisitionId, {
        status: "issued",
        issued_at: now,
        item_sn: generatedItemSn,
        updated_at: now,
        approval_timeline: timeline,
      })
      if (updateError) {
        return NextResponse.json({ error: updateError.message || "Failed to confirm issuance" }, { status: 500 })
      }
      return NextResponse.json({ success: true, requisition: updated })
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  } catch (error: any) {
    console.error("[v0] store-issue patch error:", error?.message || error)
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 })
  }
}
