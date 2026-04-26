import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getCanonicalLocationName, locationsMatch } from "@/lib/location-filter"

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-build-key")
)

// GET - Fetch regional stock requisitions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location")
    const status = searchParams.get("status")
    const userRole = searchParams.get("userRole")

    console.log("[v0] API Regional Requisitions GET - location:", location, "status:", status, "userRole:", userRole)

    let query = supabaseAdmin
      .from("regional_stock_requisitions")
      .select("*")
      .order("created_at", { ascending: false })

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error loading regional requisitions:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let requisitions = data || []

    // Regional IT Heads should only see requisitions for their own location,
    // even if location values vary in case/spacing.
    if (userRole === "regional_it_head" && location) {
      requisitions = requisitions.filter((item: any) => locationsMatch(item.requesting_location, location))
    }

    console.log("[v0] Loaded regional requisitions:", requisitions.length || 0)

    return NextResponse.json({ requisitions })
  } catch (error) {
    console.error("[v0] API Regional Requisitions GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new regional stock requisition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log("[v0] Creating regional stock requisition:", body)

    const {
      itemId,
      itemName,
      itemCode,
      itemCategory,
      centralStockAvailable,
      regionalStockCurrent,
      requestedQuantity,
      requestedBy,
      requesterUserId,
      requestingLocation,
      justification,
    } = body

    // Validate required fields
    if (!itemId || !requestedQuantity || !requestedBy || !requestingLocation) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if central store has enough stock
    if (centralStockAvailable < requestedQuantity) {
      return NextResponse.json(
        { error: "Central store does not have enough stock" },
        { status: 400 }
      )
    }

    // Check if regional stock is at or below 0 (requirement)
    if (regionalStockCurrent > 0) {
      return NextResponse.json(
        { error: "Your location still has stock. Requisitions are only allowed when stock is at 0 or below." },
        { status: 400 }
      )
    }

    // Generate requisition number
    const requisitionNumber = `RSR-${Date.now().toString(36).toUpperCase()}`

    const { data, error } = await supabaseAdmin
      .from("regional_stock_requisitions")
      .insert({
        requisition_number: requisitionNumber,
        item_id: itemId,
        item_name: itemName,
        item_code: itemCode || null,
        item_category: itemCategory || null,
        central_stock_available: centralStockAvailable,
        regional_stock_current: regionalStockCurrent,
        requested_quantity: requestedQuantity,
        requested_by: requestedBy,
        requester_user_id: requesterUserId || null,
        requesting_location: requestingLocation,
        status: "pending",
        justification: justification || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating regional requisition:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Created regional requisition:", data)

    return NextResponse.json({ requisition: data, message: "Requisition submitted for approval" })
  } catch (error) {
    console.error("[v0] API Regional Requisitions POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Approve, Reject, or Fulfill a requisition
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      requisitionId,
      action, // 'approve', 'reject', 'fulfill', 'cancel'
      approvedBy,
      approverRole,
      approvedQuantity,
      rejectionReason,
      fulfilledBy,
      notes,
    } = body

    console.log("[v0] Processing requisition action:", action, "for:", requisitionId)

    if (!requisitionId || !action) {
      return NextResponse.json(
        { error: "Requisition ID and action are required" },
        { status: 400 }
      )
    }

    // Get the current requisition
    const { data: requisition, error: fetchError } = await supabaseAdmin
      .from("regional_stock_requisitions")
      .select("*")
      .eq("id", requisitionId)
      .single()

    if (fetchError || !requisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      )
    }

    let updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (action === "approve") {
      if (!approvedBy || !approverRole) {
        return NextResponse.json(
          { error: "Approver information required" },
          { status: 400 }
        )
      }
      updateData.status = "approved"
      updateData.approved_by = approvedBy
      updateData.approver_role = approverRole
      updateData.approved_at = new Date().toISOString()
      updateData.approved_quantity = approvedQuantity || requisition.requested_quantity
      if (notes) updateData.notes = notes
    } else if (action === "reject") {
      updateData.status = "rejected"
      updateData.approved_by = approvedBy
      updateData.approver_role = approverRole
      updateData.approved_at = new Date().toISOString()
      updateData.rejection_reason = rejectionReason || "No reason provided"
      if (notes) updateData.notes = notes
    } else if (action === "cancel") {
      updateData.status = "cancelled"
      if (notes) updateData.notes = notes
    } else if (action === "fulfill") {
      // This is the main action that transfers stock
      if (!fulfilledBy) {
        return NextResponse.json(
          { error: "Fulfilled by information required" },
          { status: 400 }
        )
      }

      // Only approved requisitions can be fulfilled
      if (requisition.status !== "approved") {
        return NextResponse.json(
          { error: "Only approved requisitions can be fulfilled" },
          { status: 400 }
        )
      }

      const quantityToTransfer = requisition.approved_quantity || requisition.requested_quantity

      // Get current central store stock
      const { data: centralItem, error: centralError } = await supabaseAdmin
        .from("store_items")
        .select("*")
        .eq("id", requisition.item_id)
        .eq("location", "Central Stores")
        .single()

      if (centralError || !centralItem) {
        return NextResponse.json(
          { error: "Central store item not found" },
          { status: 404 }
        )
      }

      // Check if central store has enough stock
      if (centralItem.quantity < quantityToTransfer) {
        return NextResponse.json(
          { error: `Insufficient central stock. Available: ${centralItem.quantity}, Required: ${quantityToTransfer}` },
          { status: 400 }
        )
      }

      const targetLocation = getCanonicalLocationName(requisition.requesting_location)
      const itemSku = centralItem.sku || centralItem.item_code || requisition.item_code || null
      const itemName = centralItem.name || centralItem.item_name || requisition.item_name || "Unknown"

      // Get or check regional store stock using canonical fields and normalized location matching.
      let regionalItem = null
      const { data: regionalCandidates, error: regionalError } = await supabaseAdmin
        .from("store_items")
        .select("*")
        .ilike("location", targetLocation)

      if (!regionalError && Array.isArray(regionalCandidates)) {
        regionalItem = regionalCandidates.find((candidate: any) => {
          const sameLocation = locationsMatch(candidate.location, targetLocation)
          const sameSku = itemSku ? (candidate.sku || candidate.item_code) === itemSku : false
          const sameName = String(candidate.name || candidate.item_name || "").toLowerCase().trim() === itemName.toLowerCase().trim()
          return sameLocation && (sameSku || sameName)
        }) || null
      }

      const centralStockBefore = centralItem.quantity
      const centralStockAfter = centralItem.quantity - quantityToTransfer
      const regionalStockBefore = regionalItem?.quantity || 0
      const regionalStockAfter = regionalStockBefore + quantityToTransfer

      // Start transaction: Update central store (decrease)
      const { error: centralUpdateError } = await supabaseAdmin
        .from("store_items")
        .update({
          quantity: centralStockAfter,
          quantity_in_stock: centralStockAfter,
          updated_at: new Date().toISOString(),
        })
        .eq("id", centralItem.id)

      if (centralUpdateError) {
        console.error("[v0] Error updating central store:", centralUpdateError)
        return NextResponse.json({ error: "Failed to update central store stock" }, { status: 500 })
      }

      // Update or create regional store item (increase)
      if (regionalItem) {
        const { error: regionalUpdateError } = await supabaseAdmin
          .from("store_items")
          .update({
            quantity: regionalStockAfter,
            quantity_in_stock: regionalStockAfter,
            updated_at: new Date().toISOString(),
          })
          .eq("id", regionalItem.id)

        if (regionalUpdateError) {
          // Rollback central store change
          await supabaseAdmin
            .from("store_items")
            .update({ quantity: centralStockBefore })
            .eq("id", centralItem.id)
          
          console.error("[v0] Error updating regional store:", regionalUpdateError)
          return NextResponse.json({ error: "Failed to update regional store stock" }, { status: 500 })
        }
      } else {
        // Create new regional item
        const { error: createError } = await supabaseAdmin
          .from("store_items")
          .insert({
            name: itemName,
            sku: itemSku || `REG-${Date.now().toString(36).toUpperCase()}`,
            siv_number: centralItem.siv_number || `AUTO-${Date.now().toString(36).toUpperCase()}`,
            category: centralItem.category,
            quantity: quantityToTransfer,
            quantity_in_stock: quantityToTransfer,
            reorder_level: centralItem.reorder_level || 5,
            unit: centralItem.unit || "pcs",
            location: targetLocation,
            supplier: centralItem.supplier || null,
            reorder_level: centralItem.reorder_level || 5,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

        if (createError) {
          // Rollback central store change
          await supabaseAdmin
            .from("store_items")
            .update({ quantity: centralStockBefore })
            .eq("id", centralItem.id)
          
          console.error("[v0] Error creating regional store item:", createError)
          return NextResponse.json({ error: "Failed to create regional store item" }, { status: 500 })
        }
      }

      // Create stock transfer transaction record
      const transactionNumber = `STT-${Date.now().toString(36).toUpperCase()}`
      await supabaseAdmin
        .from("stock_transfer_transactions")
        .insert({
          transaction_number: transactionNumber,
          requisition_id: requisitionId,
          item_id: requisition.item_id,
          item_name: requisition.item_name,
          from_location: "Central Stores",
          to_location: targetLocation,
          quantity: quantityToTransfer,
          central_stock_before: centralStockBefore,
          central_stock_after: centralStockAfter,
          regional_stock_before: regionalStockBefore,
          regional_stock_after: regionalStockAfter,
          processed_by: fulfilledBy,
          approved_by: requisition.approved_by,
          notes: notes || `Fulfilled from requisition ${requisition.requisition_number}`,
          created_at: new Date().toISOString(),
        })

      updateData.status = "fulfilled"
      updateData.fulfilled_by = fulfilledBy
      updateData.fulfilled_at = new Date().toISOString()
      if (notes) updateData.notes = notes
    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be: approve, reject, cancel, or fulfill" },
        { status: 400 }
      )
    }

    // Update the requisition
    const { data, error } = await supabaseAdmin
      .from("regional_stock_requisitions")
      .update(updateData)
      .eq("id", requisitionId)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating requisition:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Requisition updated:", data)

    return NextResponse.json({ 
      requisition: data, 
      message: `Requisition ${action}ed successfully` 
    })
  } catch (error) {
    console.error("[v0] API Regional Requisitions PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
