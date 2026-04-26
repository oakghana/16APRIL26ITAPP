import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-placeholder"
)

function parseItemsRequired(itemsRequired: string | null | undefined) {
  const rawText = String(itemsRequired || "").trim()

  if (!rawText) {
    return []
  }

  const segments = rawText
    .split(/\r?\n|;/)
    .map((entry) => entry.replace(/^[\s\-•*]+/, "").trim())
    .filter(Boolean)

  const normalizedSegments = segments.length > 0 ? segments : [rawText]

  return normalizedSegments.map((segment) => {
    let quantity = 1
    let itemName = segment

    const leadingQuantityMatch = segment.match(/^(\d+)\s*(?:x\s*)?(.+)$/i)
    const trailingQuantityMatch = segment.match(/^(.+?)\s*(?:x|qty:?|quantity:?)[\s-]*(\d+)$/i)

    if (leadingQuantityMatch) {
      quantity = Number.parseInt(leadingQuantityMatch[1], 10) || 1
      itemName = leadingQuantityMatch[2].trim()
    } else if (trailingQuantityMatch) {
      quantity = Number.parseInt(trailingQuantityMatch[2], 10) || 1
      itemName = trailingQuantityMatch[1].trim()
    }

    return {
      itemName,
      quantity,
      unit: "pcs",
    }
  })
}

function generateStoreRequisitionNumber(sourceNumber: string, index: number) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const sourceSuffix = sourceNumber.split("-").pop() || "0000"
  return `REQ-${dateStr}-${sourceSuffix}-${String(index + 1).padStart(2, "0")}`
}

function resolveSourceRequestNumber(requisition: Record<string, any>) {
  return String(
    requisition.requisition_number ||
      requisition.request_number ||
      requisition.req_number ||
      requisition.reference_number ||
      requisition.id ||
      "IT-REQ"
  )
}

export async function POST(request: NextRequest) {
  try {
    const { userRole, triggeredBy } = await request.json()

    if (!["admin", "it_store_head"].includes(userRole)) {
      return NextResponse.json({ error: "Only Admin or IT Store Head can sync approved IT requisitions" }, { status: 403 })
    }

    const { data: approvedRequisitions, error: requisitionsError } = await supabaseAdmin
      .from("it_equipment_requisitions")
      .select("*")
      .order("created_at", { ascending: false })

    if (requisitionsError) {
      return NextResponse.json({ error: requisitionsError.message || "Failed to load approved IT requisitions" }, { status: 500 })
    }

    const approvedList = (approvedRequisitions || []).filter((req: any) => {
      if (req.store_head_approved === true) return false

      const status = String(req.status || "").toLowerCase().trim()
      if (["issued", "rejected", "rejected_it_head", "rejected_admin", "cancelled", "completed"].includes(status)) {
        return false
      }

      const statusSaysApproved = [
        "pending_store",
        "ready_for_issuance",
        "pending_regional_store",
        "pending_admin",
        "approved",
        "approved_it_head",
        "approved_admin",
        "approved_manager",
      ].includes(status)

      const hasApprovalMarker = Boolean(
        req.it_head_approved === true ||
        req.admin_approved === true ||
        req.it_manager_approved === true ||
        req.it_head_approved_by ||
        req.it_head_approved_by_name ||
        req.admin_approved_by ||
        req.admin_approved_by_name ||
        req.it_manager_approved_by ||
        req.it_manager_approved_by_name ||
        req.manager_approved_by ||
        req.manager_approved_by_name ||
        req.it_head_approved_at ||
        req.admin_approved_at ||
        req.it_manager_approved_at ||
        req.manager_approved_at
      )

      return statusSaysApproved || hasApprovalMarker
    })

    if (approvedList.length === 0) {
      return NextResponse.json({ success: true, createdCount: 0, skippedCount: 0, message: "No approved IT requisitions are waiting to be synced" })
    }

    const { data: existingStoreRequisitions, error: existingError } = await supabaseAdmin
      .from("store_requisitions")
      .select("it_req_number")
      .not("it_req_number", "is", null)

    if (existingError) {
      return NextResponse.json({ error: existingError.message || "Failed to load existing store requisitions" }, { status: 500 })
    }

    const existingItReqNumbers = new Set(
      (existingStoreRequisitions || [])
        .map((row: any) => String(row.it_req_number || "").trim())
        .filter(Boolean)
    )

    const requesterIds = approvedList.map((req: any) => req.requested_by_id).filter(Boolean)
    const requesterIdSet = Array.from(new Set(requesterIds))
    let requesterLocationById = new Map<string, string>()

    if (requesterIdSet.length > 0) {
      const { data: requesterProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, location")
        .in("id", requesterIdSet)

      requesterLocationById = new Map(
        (requesterProfiles || []).map((profile: any) => [String(profile.id), String(profile.location || "")])
      )
    }

    const syncCandidates = approvedList.filter((req: any) => !existingItReqNumbers.has(resolveSourceRequestNumber(req)))

    if (syncCandidates.length === 0) {
      return NextResponse.json({ success: true, createdCount: 0, skippedCount: approvedList.length, message: "All approved IT requisitions are already synced" })
    }

    const now = new Date().toISOString()
    const insertRows = syncCandidates.map((req: any, index: number) => {
      const sourceRequestNumber = resolveSourceRequestNumber(req)
      const destinationLocation = requesterLocationById.get(String(req.requested_by_id || "")) || req.department || "Head Office"
      const requestedItems = parseItemsRequired(req.items_required)
      const approvalSource = req.admin_approved_by || req.it_head_approved_by || triggeredBy || "IT Approval Workflow"

      return {
        requisition_number: generateStoreRequisitionNumber(sourceRequestNumber, index),
        requested_by: req.requested_by || "Unknown",
        beneficiary: req.requested_by || "Unknown",
        requested_by_role: "staff",
        location: "Central Stores",
        destination_location: destinationLocation,
        it_req_number: sourceRequestNumber,
        items: requestedItems.length > 0 ? requestedItems : [{ itemName: String(req.items_required || "IT request item"), quantity: 1, unit: "pcs" }],
        status: "approved",
        approved_by: approvalSource,
        notes: `Synced from approved IT requisition ${sourceRequestNumber}. Purpose: ${req.purpose || "N/A"}`,
        created_at: now,
        updated_at: now,
      }
    })

    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from("store_requisitions")
      .insert(insertRows)
      .select("id, requisition_number, it_req_number")

    if (insertError) {
      return NextResponse.json({ error: insertError.message || "Failed to sync approved IT requisitions" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      createdCount: insertedRows?.length || 0,
      skippedCount: approvedList.length - syncCandidates.length,
      syncedItRequisitionNumbers: insertRows.map((row) => row.it_req_number),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}